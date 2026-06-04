"""
4-Direction Smart Traffic Signal Controller
============================================
  NORTH  — AI camera detection (YOLOv8), green time = 3 + (rows-1)*4 sec
  SOUTH  — Fixed minimum green: 5 sec
  EAST   — Fixed minimum green: 5 sec
  WEST   — Fixed minimum green: 5 sec

  Rotation order: NORTH → EAST → SOUTH → WEST → NORTH ...
  Between each direction: YELLOW 2s → RED 1s → next direction

  ESP32 (COM3):
    "GREEN\n"   → Green LED ON  (D15), Red LED OFF (D13)
    "RED\n"     → Red LED ON   (D13), Green LED OFF (D15)
    "YELLOW\n"  → Both LEDs blink alternately

Install:
    pip install ultralytics opencv-python numpy pyserial
Run:
    python traffic_4way.py
"""

import cv2
import numpy as np
import time
import threading
from collections import deque

from ultralytics import YOLO

try:
    import serial as pyserial
    _HAS_SERIAL = True
except ImportError:
    _HAS_SERIAL = False
    print("[WARN] pip install pyserial  — running without ESP32")

# ══════════════════════════════════════════════════════════════════════════════
#  CONFIG
# ══════════════════════════════════════════════════════════════════════════════
CAMERA_INDEX    = 0
YOLO_MODEL      = "yolov8n.pt"
CONFIDENCE      = 0.60          # raised from 0.40 → fewer false positives
ROW_GAP         = 80
STABLE_FRAMES   = 6

# Minimum box area to count as a real vehicle (filters tiny false hits)
MIN_BOX_AREA    = 4000          # pixels²  — tune up if still noisy

GREEN_BASE      = 3
GREEN_EXTRA     = 4
FIXED_GREEN     = 5      # green time for S/E/W (no camera)
YELLOW_TIME     = 2
RED_WAIT        = 1

SERIAL_PORT     = "COM3"
SERIAL_BAUD     = 9600

VEHICLES = {2:"Car", 3:"Motorcycle", 5:"Bus", 7:"Truck", 1:"Bicycle"}

DIRECTIONS = ["NORTH", "EAST", "SOUTH", "WEST"]
DIR_LABEL  = {"NORTH":"N","EAST":"E","SOUTH":"S","WEST":"W"}

# Colours  BGR
COL = {
    "green_on" : (0,  210,  50),
    "yellow_on": (0,  195, 215),
    "red_on"   : (35,  35, 215),
    "off"      : (35,  35,  40),
    "bg"       : (10,  13,  18),
    "panel"    : (14,  18,  26),
    "text"     : (210,235, 255),
    "scan"     : (0,  180,  85),
    "dim"      : (80, 105, 130),
    "road"     : (28,  32,  40),
    "stripe"   : (60,  65,  75),
    "north_box": (0,  160, 255),
}

ROW_COLS = [
    (0,255,140),(0,180,255),(255,160,0),
    (200,0,255),(0,220,220),(255,80,80),
]


# ══════════════════════════════════════════════════════════════════════════════
#  Serial
# ══════════════════════════════════════════════════════════════════════════════
class SerialMgr:
    def __init__(self):
        self.connected = False
        self._ser  = None
        self._last = None
        self._lock = threading.Lock()
        if _HAS_SERIAL:
            try:
                self._ser      = pyserial.Serial(SERIAL_PORT, SERIAL_BAUD, timeout=1)
                time.sleep(2)
                self.connected = True
                print(f"[SERIAL] {SERIAL_PORT} connected")
            except Exception as e:
                print(f"[SERIAL] {e}")

    def send(self, cmd):
        if cmd == self._last: return
        self._last = cmd
        if self.connected and self._ser:
            try:
                with self._lock:
                    self._ser.write((cmd+"\n").encode())
            except: pass

    def close(self):
        if self._ser and self._ser.is_open:
            self._ser.close()


# ══════════════════════════════════════════════════════════════════════════════
#  4-Way Rotational Controller
# ══════════════════════════════════════════════════════════════════════════════
# Phase per direction slot:
#   SCAN      → only for NORTH: collecting stable rows
#   GREEN     → signal is green, timer counting down
#   YELLOW    → 2s transition
#   RED_WAIT  → 1s before advancing to next direction

class FourWayFSM:
    def __init__(self):
        self.dir_idx     = 0          # index into DIRECTIONS
        self.state       = "SCAN"     # SCAN | GREEN | YELLOW | RED_WAIT
        self._start      = time.time()
        self.green_dur   = 0
        self.locked_rows = 0
        self._history    = deque(maxlen=STABLE_FRAMES)

        # per-direction state for display
        # "green"/"yellow"/"red"
        self.dir_signals = {d:"red" for d in DIRECTIONS}
        self.dir_signals["NORTH"] = "red"

    @property
    def current_dir(self):
        return DIRECTIONS[self.dir_idx]

    def _next_dir(self):
        self.dir_idx = (self.dir_idx + 1) % len(DIRECTIONS)
        # reset all to red
        for d in DIRECTIONS:
            self.dir_signals[d] = "red"

    def update(self, raw_rows):
        """
        raw_rows: detected row count (used only when current_dir==NORTH in SCAN)
        Returns: (phase, active_signal_colour, serial_cmd)
        """
        elapsed  = time.time() - self._start
        cur      = self.current_dir
        is_north = (cur == "NORTH")

        # ── SCAN phase (North only) ───────────────────────────────────────────
        if self.state == "SCAN":
            if is_north:
                self._history.append(raw_rows)
                if len(self._history) == STABLE_FRAMES:
                    stable = round(sum(self._history)/STABLE_FRAMES)
                    stable = max(stable, 1)
                    self.locked_rows = stable
                    self.green_dur   = GREEN_BASE + (stable-1)*GREEN_EXTRA
                    self._go("GREEN")
                    print(f"[FSM] NORTH LOCKED rows={stable} green={self.green_dur}s")
            else:
                # non-North: no scan needed, jump straight to GREEN with fixed time
                self.locked_rows = 0
                self.green_dur   = FIXED_GREEN
                self._go("GREEN")
                print(f"[FSM] {cur} GREEN {self.green_dur}s (fixed)")
            self.dir_signals = {d:"red" for d in DIRECTIONS}
            return "SCAN", "red", "RED"

        # ── GREEN ─────────────────────────────────────────────────────────────
        if self.state == "GREEN":
            self.dir_signals = {d:"red" for d in DIRECTIONS}
            self.dir_signals[cur] = "green"
            if elapsed >= self.green_dur:
                self._go("YELLOW")
            return "GREEN", "green", "GREEN"

        # ── YELLOW ────────────────────────────────────────────────────────────
        if self.state == "YELLOW":
            self.dir_signals = {d:"red" for d in DIRECTIONS}
            self.dir_signals[cur] = "yellow"
            if elapsed >= YELLOW_TIME:
                self._go("RED_WAIT")
            return "YELLOW", "yellow", "YELLOW"

        # ── RED_WAIT ──────────────────────────────────────────────────────────
        if self.state == "RED_WAIT":
            self.dir_signals = {d:"red" for d in DIRECTIONS}
            if elapsed >= RED_WAIT:
                self._next_dir()
                self._history.clear()
                # if next is north → SCAN, else straight to GREEN (via SCAN which skips instantly)
                self._go("SCAN")
                print(f"[FSM] → {self.current_dir}")
            return "RED_WAIT", "red", "RED"

        return "SCAN","red","RED"

    def _go(self, s):
        self.state  = s
        self._start = time.time()

    def remaining(self):
        e = time.time() - self._start
        if self.state == "GREEN":    return max(0.0, self.green_dur - e)
        if self.state == "YELLOW":   return max(0.0, YELLOW_TIME - e)
        if self.state == "RED_WAIT": return max(0.0, RED_WAIT - e)
        return 0.0

    def progress(self):
        e = time.time() - self._start
        d = {"GREEN":max(self.green_dur,0.001),"YELLOW":YELLOW_TIME,"RED_WAIT":RED_WAIT}
        return min(1.0, e / d.get(self.state, 1.0))

    def scan_fill(self):
        return len(self._history)/STABLE_FRAMES

    def is_scanning(self):
        return self.state == "SCAN"


# ══════════════════════════════════════════════════════════════════════════════
#  Detection
# ══════════════════════════════════════════════════════════════════════════════
def detect(model, frame):
    """Detect vehicles only in the LEFT half of the frame (camera region)."""
    fh, fw = frame.shape[:2]
    cam_w  = fw // 2                    # only count boxes inside the camera half

    boxes=[]
    for box in model(frame, verbose=False)[0].boxes:
        cid = int(box.cls[0])
        if cid not in VEHICLES: continue
        cf  = float(box.conf[0])
        if cf < CONFIDENCE:     continue
        x1,y1,x2,y2 = map(int, box.xyxy[0])

        # discard boxes whose centre is outside the camera half
        cx = (x1 + x2) // 2
        if cx > cam_w:
            continue

        # clamp to camera half boundary
        x2 = min(x2, cam_w)

        # discard tiny detections (false positives from background)
        area = (x2 - x1) * (y2 - y1)
        if area < MIN_BOX_AREA:
            continue

        boxes.append((x1,y1,x2,y2,cid))
    return boxes


def make_rows(boxes):
    if not boxes: return []
    sb = sorted(boxes, key=lambda b:(b[1]+b[3])/2)
    rows=[[sb[0]]]
    prev=(sb[0][1]+sb[0][3])/2
    for b in sb[1:]:
        cy=(b[1]+b[3])/2
        if cy-prev>ROW_GAP: rows.append([b])
        else:               rows[-1].append(b)
        prev=cy
    return rows


# ══════════════════════════════════════════════════════════════════════════════
#  Drawing — 4-way intersection UI
# ══════════════════════════════════════════════════════════════════════════════

def alpha_rect(frame, x,y,w,h, colour, alpha=0.80):
    ov=frame.copy()
    cv2.rectangle(ov,(x,y),(x+w,y+h),colour,-1)
    cv2.addWeighted(ov,alpha,frame,1-alpha,0,frame)


def draw_signal_lamp(frame, cx,cy, sig_state, size=18):
    """
    sig_state: "green" | "yellow" | "red"
    Draws 3 stacked lamps (R on top, G on bottom) with the active one glowing.
    """
    housing_w = size*2+8
    housing_h = size*6+16
    hx = cx - housing_w//2
    hy = cy - housing_h//2

    # housing
    cv2.rectangle(frame,(hx,hy),(hx+housing_w,hy+housing_h),(14,16,22),-1)
    cv2.rectangle(frame,(hx,hy),(hx+housing_w,hy+housing_h),(50,70,90),1)

    lamps = [("red",0),("yellow",1),("green",2)]
    for name,i in lamps:
        lcy = hy + size + i*(size*2+4)
        lcx = cx
        active = (name == sig_state)
        col = COL[name+"_on"] if active else COL["off"]
        cv2.circle(frame,(lcx,lcy),size-2,col,-1)
        if active:
            cv2.circle(frame,(lcx,lcy),size,col,2)
            glow = tuple(min(255,v+60) for v in col)
            cv2.circle(frame,(lcx,lcy),size+4,tuple(v//4 for v in glow),2)


def draw_intersection(frame, fsm, cam_frame, tick):
    """
    Draws the 4-way intersection diagram on the right half of the screen.
    Left half = camera feed (north).
    """
    fh,fw = frame.shape[:2]

    # ── split layout ─────────────────────────────────────────────────────────
    cam_w  = fw // 2
    map_x  = cam_w
    map_w  = fw - cam_w
    map_cx = map_x + map_w//2
    map_cy = fh // 2

    # paste camera to left half
    if cam_frame is not None:
        cam_resized = cv2.resize(cam_frame, (cam_w, fh))
        frame[0:fh, 0:cam_w] = cam_resized

    # ── intersection background ───────────────────────────────────────────────
    cv2.rectangle(frame,(map_x,0),(fw,fh),COL["bg"],-1)

    # grid lines (subtle)
    for gx in range(map_x, fw, 30):
        cv2.line(frame,(gx,0),(gx,fh),(18,22,30),1)
    for gy in range(0,fh,30):
        cv2.line(frame,(map_x,gy),(fw,gy),(18,22,30),1)

    # ── road surfaces ─────────────────────────────────────────────────────────
    road_w = 80
    # horizontal road (E-W)
    cv2.rectangle(frame,
                  (map_x, map_cy-road_w//2),
                  (fw,    map_cy+road_w//2),
                  COL["road"],-1)
    # vertical road (N-S)
    cv2.rectangle(frame,
                  (map_cx-road_w//2, 0),
                  (map_cx+road_w//2, fh),
                  COL["road"],-1)

    # intersection box
    cv2.rectangle(frame,
                  (map_cx-road_w//2, map_cy-road_w//2),
                  (map_cx+road_w//2, map_cy+road_w//2),
                  (22,28,36),-1)

    # road stripes H
    for sx in range(map_x+10, map_cx-road_w//2, 28):
        cv2.line(frame,(sx,map_cy),(sx+14,map_cy),COL["stripe"],3)
    for sx in range(map_cx+road_w//2+10, fw-10, 28):
        cv2.line(frame,(sx,map_cy),(sx+14,map_cy),COL["stripe"],3)

    # road stripes V
    for sy in range(10, map_cy-road_w//2, 28):
        cv2.line(frame,(map_cx,sy),(map_cx,sy+14),COL["stripe"],3)
    for sy in range(map_cy+road_w//2+10, fh-10, 28):
        cv2.line(frame,(map_cx,sy),(map_cx,sy+14),COL["stripe"],3)

    # ── traffic lights at each arm ────────────────────────────────────────────
    pad = 40
    signals = {
        "NORTH": (map_cx + road_w//2 + pad,  map_cy - road_w//2 - pad),
        "SOUTH": (map_cx - road_w//2 - pad,  map_cy + road_w//2 + pad),
        "EAST" : (map_cx + road_w//2 + pad,  map_cy + road_w//2 + pad),
        "WEST" : (map_cx - road_w//2 - pad,  map_cy - road_w//2 - pad),
    }
    for d,(sx,sy) in signals.items():
        sig_state = fsm.dir_signals[d]
        draw_signal_lamp(frame, sx, sy, sig_state, size=16)

    # ── direction labels ──────────────────────────────────────────────────────
    FONT = cv2.FONT_HERSHEY_DUPLEX
    label_pos = {
        "NORTH": (map_cx-12, 28),
        "SOUTH": (map_cx-12, fh-12),
        "EAST" : (fw-38,  map_cy+6),
        "WEST" : (map_x+8, map_cy+6),
    }
    for d,(lx,ly) in label_pos.items():
        is_active = (fsm.current_dir==d and fsm.state!="RED_WAIT" and fsm.state!="SCAN") or \
                    (fsm.current_dir==d and fsm.state=="SCAN")
        col = COL["north_box"] if d=="NORTH" else COL["text"]
        if is_active:
            col = COL["green_on"] if fsm.dir_signals[d]=="green" \
                  else COL["yellow_on"] if fsm.dir_signals[d]=="yellow" \
                  else COL["text"]
        cv2.putText(frame, d, (lx,ly), FONT, 0.60, col, 1, cv2.LINE_AA)

    # ── active direction highlight box ────────────────────────────────────────
    cur = fsm.current_dir
    hs = {
        "NORTH": (map_cx-road_w//2, 0,    road_w, map_cy-road_w//2),
        "SOUTH": (map_cx-road_w//2, map_cy+road_w//2, road_w, fh-(map_cy+road_w//2)),
        "EAST" : (map_cx+road_w//2, map_cy-road_w//2, map_x+map_w-(map_cx+road_w//2), road_w),
        "WEST" : (map_x, map_cy-road_w//2, map_cx-road_w//2-map_x, road_w),
    }
    if cur in hs:
        hx2,hy2,hw2,hh2 = hs[cur]
        sig_col = fsm.dir_signals[cur]
        hcol = COL["green_on"] if sig_col=="green" \
               else COL["yellow_on"] if sig_col=="yellow" \
               else COL["dim"]
        cv2.rectangle(frame,(hx2,hy2),(hx2+hw2,hy2+hh2),hcol,2)

    # ── centre small label only ───────────────────────────────────────────────
    if fsm.current_dir == "NORTH" and fsm.state == "SCAN":
        stxt = "SCAN"
        scol = COL["scan"]
    else:
        stxt = DIR_LABEL[fsm.current_dir]
        sig_s = fsm.dir_signals[fsm.current_dir]
        scol = COL["green_on"] if sig_s=="green" else COL["yellow_on"] if sig_s=="yellow" else COL["dim"]
    (sw,sh),_ = cv2.getTextSize(stxt, FONT, 0.80, 2)
    cv2.putText(frame, stxt, (map_cx-sw//2, map_cy+sh//2), FONT, 0.80, scol, 1, cv2.LINE_AA)

    return frame


def draw_topright_timer(frame, fsm):
    """Large countdown timer fixed at TOP-RIGHT corner of the full frame."""
    fh, fw = frame.shape[:2]
    FONT   = cv2.FONT_HERSHEY_DUPLEX

    # signal colour
    sig_s = fsm.dir_signals[fsm.current_dir]
    tcol  = COL["green_on"]  if sig_s == "green"  else \
            COL["yellow_on"] if sig_s == "yellow" else \
            COL["scan"]      if fsm.state == "SCAN" else COL["dim"]

    # ── Box background ────────────────────────────────────────────────────────
    box_w, box_h = 210, 110
    bx = fw - box_w - 10
    by = 8
    alpha_rect(frame, bx, by, box_w, box_h, COL["panel"], alpha=0.88)
    cv2.rectangle(frame, (bx, by), (bx+box_w, by+box_h), tcol, 1)

    # ── Direction label ───────────────────────────────────────────────────────
    dir_txt = fsm.current_dir
    (dw, dh), _ = cv2.getTextSize(dir_txt, FONT, 0.60, 1)
    cv2.putText(frame, dir_txt, (bx + (box_w-dw)//2, by+18),
                FONT, 0.60, tcol, 1, cv2.LINE_AA)

    # ── Timer digits ──────────────────────────────────────────────────────────
    if fsm.state in ("GREEN", "YELLOW", "RED_WAIT"):
        rem    = fsm.remaining()
        secs   = int(rem)
        tenths = int((rem - secs) * 10)
        timer_txt = f"{secs:02d}.{tenths}"
        FS, FT = 2.2, 5
    elif fsm.state == "SCAN":
        n = len(fsm._history)
        timer_txt = f"{n}/{STABLE_FRAMES}"
        FS, FT = 1.6, 3
    else:
        timer_txt = "--"
        FS, FT = 2.2, 4

    (tw, th), _ = cv2.getTextSize(timer_txt, FONT, FS, FT)
    tx = bx + (box_w - tw) // 2
    ty = by + box_h - 14
    cv2.putText(frame, timer_txt, (tx+2, ty+2), FONT, FS, (0,0,0), FT+3, cv2.LINE_AA)
    cv2.putText(frame, timer_txt, (tx,   ty),   FONT, FS, tcol,    FT,   cv2.LINE_AA)

    # ── Progress bar at bottom of box ─────────────────────────────────────────
    pb_x = bx + 8
    pb_y = by + box_h - 6
    pb_w = box_w - 16
    pb_h = 4
    cv2.rectangle(frame, (pb_x, pb_y), (pb_x+pb_w, pb_y+pb_h), (30,35,45), -1)
    if fsm.state in ("GREEN","YELLOW","RED_WAIT"):
        fill = int(pb_w * (1.0 - fsm.progress()))
        if fill > 0:
            cv2.rectangle(frame, (pb_x, pb_y), (pb_x+fill, pb_y+pb_h), tcol, -1)
    elif fsm.state == "SCAN":
        fill = int(pb_w * fsm.scan_fill())
        if fill > 0:
            cv2.rectangle(frame, (pb_x, pb_y), (pb_x+fill, pb_y+pb_h), COL["scan"], -1)


def draw_cam_overlay(frame, last_rows, phase, fsm, tick):
    """Overlays on the LEFT (camera) half."""
    fh,fw = frame.shape[:2]
    cam_w = fw//2
    FONT  = cv2.FONT_HERSHEY_DUPLEX

    # dim when not detecting
    if phase != "SCAN":
        ov=frame.copy()
        cv2.rectangle(ov,(0,0),(cam_w,fh),(6,6,14),-1)
        cv2.addWeighted(ov,0.40,frame,0.60,0,frame)
    else:
        # scan line
        y  = int(tick % fh)
        ov = frame.copy()
        cv2.line(ov,(0,y),(cam_w,y),(0,200,100),1)
        cv2.addWeighted(ov,0.25,frame,0.75,0,frame)
        col,s=COL["scan"],28
        for (px,py),(dx,dy) in zip(
            [(30,30),(cam_w-30,30),(30,fh-30),(cam_w-30,fh-30)],
            [(1,1),(-1,1),(1,-1),(-1,-1)]):
            cv2.line(frame,(px,py),(px+dx*s,py),col,2)
            cv2.line(frame,(px,py),(px,py+dy*s),col,2)

    # vehicle boxes — clipped to left (camera) half only
    for ri,row in enumerate(last_rows):
        col=ROW_COLS[ri%len(ROW_COLS)]
        ys=[]
        for (x1,y1,x2,y2,cid) in row:
            # hard-clip draw coords to camera half
            dx2 = min(x2, cam_w)
            if x1 >= cam_w:
                continue
            cv2.rectangle(frame,(x1,y1),(dx2,y2),col,2)
            lbl=VEHICLES[cid]
            lx,ly=x1,max(y1-5,14)
            (tw,th),_=cv2.getTextSize(lbl,cv2.FONT_HERSHEY_SIMPLEX,0.45,1)
            cv2.rectangle(frame,(lx,ly-th-2),(lx+tw+4,ly+2),col,-1)
            cv2.putText(frame,lbl,(lx+2,ly),cv2.FONT_HERSHEY_SIMPLEX,0.45,(0,0,0),1,cv2.LINE_AA)
            ys+=[y1,y2]
        if ys:
            mid=(min(ys)+max(ys))//2
            cv2.putText(frame,f"ROW {ri+1}",(8,mid),cv2.FONT_HERSHEY_SIMPLEX,0.60,col,2,cv2.LINE_AA)

    # NORTH badge
    alpha_rect(frame,0,0,cam_w,34,COL["panel"],0.85)
    is_north_green = (fsm.current_dir=="NORTH" and fsm.dir_signals["NORTH"]=="green")
    badge_col = COL["green_on"] if is_north_green else COL["north_box"]
    cv2.putText(frame,"[N] NORTH  (AI CAMERA)",(8,24),FONT,0.65,badge_col,1,cv2.LINE_AA)

    if phase=="SCAN":
        n=len(fsm._history)
        scan_txt=f"SCANNING {n}/{STABLE_FRAMES}"
        cv2.putText(frame,scan_txt,(8,56),FONT,0.65,COL["scan"],1,cv2.LINE_AA)
        # scan bar
        bx,by,bw,bh=8,64,cam_w-16,10
        cv2.rectangle(frame,(bx,by),(bx+bw,by+bh),(28,34,44),-1)
        fill=int(bw*fsm.scan_fill())
        if fill>0: cv2.rectangle(frame,(bx,by),(bx+fill,by+bh),COL["scan"],-1)
        cv2.rectangle(frame,(bx,by),(bx+bw,by+bh),(55,75,95),1)
    else:
        row_txt=f"Rows locked: {fsm.locked_rows}  |  Green: {fsm.green_dur}s"
        cv2.putText(frame,row_txt,(8,56),FONT,0.55,COL["green_on"],1,cv2.LINE_AA)


def draw_bottom_bar(frame, fsm, fps, serial_ok):
    """Status strip at very bottom."""
    fh,fw = frame.shape[:2]
    alpha_rect(frame,0,fh-36,fw,36,COL["panel"],0.88)
    FONT = cv2.FONT_HERSHEY_SIMPLEX

    # active direction
    cur = fsm.current_dir
    sig = fsm.dir_signals[cur]
    dcol = COL["green_on"] if sig=="green" else COL["yellow_on"] if sig=="yellow" else COL["dim"]
    cv2.putText(frame,f"ACTIVE: {cur}",(8,fh-10),FONT,0.55,dcol,1)

    # sequence display
    seq_x=220
    for i,d in enumerate(DIRECTIONS):
        is_cur=(d==cur)
        dsig=fsm.dir_signals[d]
        c=COL["green_on"] if dsig=="green" else COL["yellow_on"] if dsig=="yellow" else COL["dim"]
        if is_cur:
            cv2.rectangle(frame,(seq_x-2,fh-32),(seq_x+40,fh-4),c,1)
        cv2.putText(frame,DIR_LABEL[d],(seq_x+8,fh-10),FONT,0.60,c,1)
        seq_x+=50

    # fps
    cv2.putText(frame,f"FPS:{fps:.1f}",(seq_x+20,fh-10),FONT,0.50,(120,150,180),1)

    # ESP badge
    sc=(0,195,80) if serial_ok else (55,55,200)
    st="ESP32:OK" if serial_ok else "ESP32:--"
    cv2.putText(frame,st,(fw-130,fh-10),FONT,0.50,sc,1)

    # timing legend
    cv2.putText(frame,f"N=AI  S/E/W={FIXED_GREEN}s fixed",
                (fw-320,fh-10),FONT,0.42,(80,100,130),1)


def draw_progress_strip(frame, fsm):
    fh,fw=frame.shape[:2]
    cv2.rectangle(frame,(0,fh-40),(fw,fh-36),(18,20,28),-1)
    sig=fsm.dir_signals[fsm.current_dir]
    col=COL["green_on"] if sig=="green" else COL["yellow_on"] if sig=="yellow" else COL["dim"]
    if fsm.state in ("GREEN","YELLOW","RED_WAIT"):
        fw2=int(fw*(1.0-fsm.progress()))
        if fw2>0: cv2.rectangle(frame,(0,fh-40),(fw2,fh-36),col,-1)


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main():
    print(f"[INFO] Loading {YOLO_MODEL}…")
    model = YOLO(YOLO_MODEL)
    print("[INFO] Model ready.\n")
    print("  NORTH=AI camera | SOUTH/EAST/WEST=5s fixed | Rotation: N→E→S→W")

    serial_mgr = SerialMgr()

    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        raise SystemExit(f"[ERROR] Cannot open camera {CAMERA_INDEX}")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT,  720)
    cap.set(cv2.CAP_PROP_FPS, 30)

    print("[INFO] Camera open. Press Q to quit.\n")

    fsm        = FourWayFSM()
    fps        = 0.0
    fps_timer  = time.time()
    fc         = 0
    tick       = 0
    last_boxes = []
    last_rows  = []
    cam_frame  = None    # latest raw camera frame for intersection map

    while True:
        ret, raw = cap.read()
        if not ret:
            time.sleep(0.02); continue

        cam_frame = raw.copy()

        # Detection only when NORTH is scanning
        if fsm.current_dir=="NORTH" and fsm.is_scanning():
            last_boxes = detect(model, raw)
            last_rows  = make_rows(last_boxes)
        elif fsm.current_dir != "NORTH":
            last_boxes = []
            last_rows  = []

        num_rows             = len(last_rows)
        phase, sig, ser_cmd  = fsm.update(num_rows)

        # Serial only fires for NORTH direction
        if fsm.current_dir == "NORTH":
            serial_mgr.send(ser_cmd)
        else:
            serial_mgr.send("RED")   # keep LED red when non-North is active

        # ── Build display frame ───────────────────────────────────────────────
        fh,fw = raw.shape[:2]
        display = np.zeros((fh, fw, 3), dtype=np.uint8)

        # draw intersection map (puts camera on left half too)
        draw_intersection(display, fsm, cam_frame, tick)

        # overlay on camera (left) half
        draw_cam_overlay(display, last_rows, phase, fsm, tick)

        # top-right corner timer
        draw_topright_timer(display, fsm)

        # bottom bar
        draw_progress_strip(display, fsm)
        draw_bottom_bar(display, fsm, fps, serial_mgr.connected)

        # divider line
        cv2.line(display,(fw//2,0),(fw//2,fh),(50,70,90),1)

        tick += 5
        fc   += 1
        if time.time()-fps_timer>=1.0:
            fps=fc/(time.time()-fps_timer); fc=0; fps_timer=time.time()

        cv2.imshow("4-Way Smart Traffic Signal", display)
        if cv2.waitKey(1)&0xFF==ord('q'):
            break

    serial_mgr.send("RED")
    serial_mgr.close()
    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Stopped.")


if __name__ == "__main__":
    main()