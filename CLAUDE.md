# WellSense AIoT Hackathon — Project Context

## Overview

**Hackathon:** WellSense AIoT & System Product Hackathon (Super AI Engineer Season 6, On-Site Week 3)  
**Deadline:** Fri May 29, 2026 — slides submitted 09:00, demo setup 09:00–10:00  
**Story:** Nat (post car-accident patient) recovers at home with cat Mango — 3 subteams form one closed ecosystem  
**Hardware sets:** 3 sets (one per subteam), each identical in components

See `HARDWARE.md` for all sensor specs, wiring, sampling rates, limitations, and architecture diagrams.  
See `pet-care-hardware-guide.md` for a beginner-friendly walkthrough of the Smart Pet Care hardware.

---

## The Three Subteams

| Subteam | Product | Our role in the story |
|---------|---------|----------------------|
| **Smart Pet Care** ← us | Monitor Mango (cat) at home | Nat checks on Mango remotely while in rehab |
| Smart Pillbox | Medication adherence tracking | Reminds Nat to take pills on schedule |
| Smart Gait Aid | Walker/cane movement quality | Guides Nat's rehab gait safely |

All three share a dashboard — peace of mind from one screen.

---

## Smart Pet Care — What We're Monitoring

| Signal | Sensor | Insight |
|--------|--------|---------|
| Food bowl level | Modulino DISTANCE | Is Mango hungry? |
| Room temperature | Modulino THERMO | Is the room safe for a cat? |
| Cat activity | Modulino MOVEMENT | Is Mango active or unusually still? |
| Visual check | Phone camera (WiFi) | Quick snapshot on demand |

**Outputs:** Modulino PIXELS (status beacon) + Modulino BUZZER (heat alert) + WiFi dashboard

---

## System Flow (Judging Requirement)

```
Input → Processing → State → Dashboard → Feedback
```

| Step | Our implementation |
|------|--------------------|
| Input | DISTANCE + THERMO + MOVEMENT sensors |
| Processing | UNO Q fuses readings, applies thresholds |
| State | ALL_OK / HUNGRY / TOO_HOT / INACTIVE_WARNING |
| Dashboard | Live sensor values + state on browser/phone |
| Feedback | PIXELS color + BUZZER tone react to state |

---

## Judging Rubric

| Criterion | Points | How we satisfy it |
|-----------|--------|-------------------|
| Problem & User Value | 15 | Nat's anxiety about Mango anchors every sensor choice |
| System Architecture & HW Use | 20 | UNO Q + Qwiic chain + WiFi dashboard (see HARDWARE.md) |
| Multi-Sensor Insight & AI Logic | 20 | 3 sensors → 4 states with threshold logic |
| Dashboard & Feedback Interaction | 15 | Live values + PIXELS/BUZZER react to state |
| Prototype Quality & Low-Power | 15 | Modulino plug-and-play, calibrated sensors |
| Business Canvas, Demo & Storytelling | 15 | Nat/Mango story + 3-min demo |

**Safe language:** wellness cue, behavior awareness, self-monitoring, support/reminder/guide  
**Avoid:** diagnosis, treatment, medical decision, stress detection as fact

---

## Library Dependencies

```
Arduino_Modulino  v0.7.0   — all Modulino modules
MsgPack           v0.4.2   — required by Modulino
Arduino_RouterBridge       — Monitor.print on UNO Q
WiFi (built-in)            — UNO Q WiFi dashboard
```

---

## Hackathon Timeline

| Date | Event |
|------|-------|
| Sun May 24 | Team names submitted by 20:00 |
| Mon May 25 | Office hour 13:30, check-in 20:30 |
| Tue May 26 | Topic names 10:00, Med team office hours 13:00 |
| Thu May 28 | Technical consultation (UNO Q) 09:00–16:30 |
| **Fri May 29** | **Submit slides 09:00 · Demo setup 09:00–10:00 · No edits after setup** |
