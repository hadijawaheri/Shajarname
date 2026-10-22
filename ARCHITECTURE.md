# Khandan Najaf — System Architecture

> **خاندان نجف** | Smart Genealogy Platform  
> Full-Stack: NestJS (v11) + Next.js (v16) + MongoDB + Pure SVG Canvas

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack & Approved Libraries](#2-technology-stack--approved-libraries)
3. [System Flow & Communication](#3-system-flow--communication)
4. [Database Entity Relationship](#4-database-entity-relationship)
5. [Performance Architecture](#5-performance-architecture)
6. [Read-Only Canvas & Auto-Layout Engine](#6-read-only-canvas--auto-layout-engine)
7. [Time-Travel Simulator Logic](#7-time-travel-simulator-logic)
8. [Islamic Mahram Engine](#8-islamic-mahram-engine)
9. [Relationship Path-Finder](#9-relationship-path-finder)
10. [API Endpoints Reference](#10-api-endpoints-reference)
11. [Port Mapping](#11-port-mapping)

---

## 1. System Overview

Khandan Najaf is a bilingual (fa/ar) smart family tree platform for documenting, visualizing, and analyzing multi-generational family structures. The system consists of:

```
┌──────────────────────────────────────────────────────┐
│              Browser (User Interface)                 │
│                                                      │
│   Next.js 16 — Port 7782 (dev: 3000)                 │
│   ┌──────────────────────────────────────────────┐   │
│   │  Read-Only Neumorphic Canvas (5000×5000px)   │   │
│   │  Pure SVG bezier connections                 │   │
│   │  CSS Transform pan/zoom (no heavy libs)      │   │
│   │  Time-Travel Slider (year filter)            │   │
│   └──────────────────────────────────────────────┘   │
└─────────────────────┬────────────────────────────────┘
                      │ HTTP REST v1 (JSON)
                      │
┌─────────────────────▼────────────────────────────────┐
│   NestJS 11 API Server — Port 7781                   │
│   ┌──────────────────────────────────────────────┐   │
│   │  MembersModule (CRUD + Mahram + Relationship)│   │
│   │  ValidationPipe (class-validator + transform)│   │
│   │  Soft-delete enforcement (deleted: false)    │   │
│   │  AP→EN digit normalization (convertAPToEng)  │   │
│   └──────────────────────────────────────────────┘   │
└─────────────────────┬────────────────────────────────┘
                      │ Mongoose ODM
                      │
┌─────────────────────▼────────────────────────────────┐
│   MongoDB — khandan_najaf database                   │
│   ┌────────────────┐  ┌────────────────────────┐    │
│   │  members       │  │  marriages             │    │
│   │  collection    │  │  collection            │    │
│   └────────────────┘  └────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack & Approved Libraries

### Frontend (Bundle-Optimized)

| Library | Version | Purpose | Why Chosen |
|---------|---------|---------|-----------|
| `next` | 16.x | React framework | App router, streaming, zero-config |
| `react` | 19.x | UI rendering | Latest concurrent features |
| `html-to-image` | ^1.11 | Ultra-HD PNG/PDF export | DOM-based, no server dependency, ~20KB |
| `tailwindcss` | ^4 | Utility CSS | Tree-shaken, near-zero runtime |
| **Pure SVG** | native | Canvas connections | Zero bundle cost, GPU-rendered at 60fps |
| **CSS Transforms** | native | Pan & Zoom | `translate(px,py) scale(n)` — no library |

> **Explicitly NOT installed:** React Flow, GoJS, D3.js, Cytoscape — these add 1–4MB to bundle size.
> Since the canvas is READ-ONLY, all their interactive features are unnecessary overhead.

### Backend (RAM-Optimized)

| Library | Version | Purpose |
|---------|---------|---------|
| `@nestjs/common` + `@nestjs/core` | ^11 | Modular DI framework |
| `@nestjs/mongoose` + `mongoose` | ^11 / ^9 | MongoDB ODM |
| `class-validator` + `class-transformer` | ^0.15 / ^0.5 | DTO validation + @Transform normalization |
| `bcrypt` | ^6 | Password hashing (10 rounds) |
| `sharp` | ^0.35 | Image resizing (avatars) |
| `@nestjs/platform-express` + `multer` | ^11 / built-in | File upload handling |
| `@nestjs/jwt` + `passport-jwt` | ^11 / ^4 | Stateless JWT auth |
| `@nestjs/config` | ^4 | ENV-based configuration |

---

## 3. System Flow & Communication

```
Frontend (Next.js)                    Backend (NestJS)
─────────────────────                 ─────────────────────

Page Load
  │
  ├─► GET /v1/members ───────────────► MembersController.findAll()
  │                                       │
  │   ◄─── { members: [...] } ────────── memberModel.find({ deleted: false })
  │
  ├─► GET /v1/members/mahram-check?   ► MembersService.checkIsMahram()
  │       activeUserId=X&targetMember=Y     (BFS graph traversal)
  │   ◄─── { isMahram: true/false }
  │
  ├─► POST /v1/members ─────────────► MembersController.create()
  │   Body: CreateMemberDto             │
  │   (@Transform normalizes mobile)    ├─ duplicate mobile check
  │                                     ├─ bcrypt.hash(password, 10)
  │   ◄─── { member: {...} } ──────────┘ memberModel.save()
  │
  ├─► POST /v1/members/marriages ───► createMarriage(spouseA, spouseB)
  │   ◄─── { marriage: {...} }
  │
  └─► GET /v1/members/relationship? ► MembersService.findRelationship()
          userAId=X&userBId=Y&lang=fa    (BFS path → Persian/Arabic label)
      ◄─── { relationship: "پدربزرگ پدری" }
```

### Input Normalization Pipeline

```
HTTP Request Body
       │
       ▼
class-transformer @Transform (DTO level)
  convertAPToEnglish("09۱۲٣٤56789")
       │ → "09123456789"
       ▼
class-validator @IsString, @IsNotEmpty, @IsEnum
       │
       ▼
MembersService (business logic)
       │
       ▼
MongoDB (clean, ASCII-only mobile numbers)
```

---

## 4. Database Entity Relationship

### Member Schema

```typescript
Member {
  _id:             ObjectId           // Auto-generated
  name:            string             // First name (Arabic or Persian)
  lastName:        string             // Last name
  mobile:          string (unique)    // Normalized ASCII digits only
  gender:          'male' | 'female'
  birthday:        Date
  deathday?:       Date               // null = living
  biography?:      string
  language:        'fa' | 'ar'        // UI preference
  username?:       string (sparse)
  passwordHash?:   string             // bcrypt(10), never stored raw
  role:            'admin' | 'member'
  positionX:       number             // Frontend canvas hint (auto-computed)
  positionY:       number             // Frontend canvas hint (auto-computed)
  isOnCanvas:      boolean
  parentMarriageId?: string           // Links this member to their parents' Marriage doc
  avatar?:         string             // File path under /public/avatars/
  deleted:         boolean            // Soft-delete flag (NEVER physically removed)
  createdAt:       Date               // Mongoose timestamps
  updatedAt:       Date
}
```

### Marriage Schema

```typescript
Marriage {
  _id:           ObjectId
  spouseA:       ObjectId -> Member   // First spouse (husband)
  spouseB:       ObjectId -> Member   // Second spouse (wife)
  marriageDate?: Date
  isCurrent:     boolean             // Active marriage flag
  children:      ObjectId[]          // Array of child Member IDs ($addToSet pattern)
  deleted:       boolean             // Soft-delete flag
  createdAt:     Date
  updatedAt:     Date
}
```

### Entity Relationship Diagram

```
Member <──────────────────── Marriage ──────────────────── Member
 (spouseA)                                                  (spouseB)
     │                           │
     │                           └──── children: [Member._id, ...]
     │
     └─ Member.parentMarriageId ──► Marriage._id
        (each child references the Marriage that produced them)
```

### Ancestry Resolution

To reconstruct the full family tree for a member C:

1. Look up `C.parentMarriageId` → `Marriage M`
2. `M.spouseA` = father, `M.spouseB` = mother
3. For grandmother: look up `M.spouseA.parentMarriageId` → `Marriage M2`, etc.

This allows O(depth) ancestry traversal without recursive joins.

### Soft-Delete Enforcement

Every Mongoose query in the service layer includes `{ deleted: false }`:

```typescript
// Correct pattern (enforced everywhere)
this.memberModel.find({ deleted: false })
this.memberModel.findOne({ _id: id, deleted: false })
this.memberModel.findOneAndUpdate({ _id: id, deleted: false }, { $set: payload }, { new: true })
```

---

## 5. Performance Architecture

### Why No Heavy Canvas Libraries

The tree canvas is strictly read-only for node positioning. Users cannot drag cards. This eliminates the entire justification for graph libraries:

| Metric | React Flow | GoJS | Our Approach |
|--------|-----------|------|-------------|
| Bundle size | ~200KB | ~400KB | ~0KB |
| Pan/Zoom | Built-in | Built-in | CSS `transform: translate() scale()` |
| Connections | Built-in | Built-in | Native `<svg><path>` |
| Drag nodes | yes (not needed) | yes (not needed) | Removed by design |
| FPS during pan | ~45fps | ~40fps | ~60fps (GPU transform) |

### CSS Transform Pan/Zoom

The entire 5000x5000px canvas div is transformed using a single CSS property:

```css
transform: translate(${panX}px, ${panY}px) scale(${scale});
```

- **Pan**: Mouse `mousemove` delta updates `panX` / `panY` state
- **Zoom**: Wheel event updates `scale` clamped to `[0.2, 2.5]`
- **GPU acceleration**: `transform` is composited on the GPU — no layout reflow
- **Transition**: Smooth `transition: transform 0.4s cubic-bezier(0.4,0,0.2,1)` except during drag

### SVG Bezier Connection Math

#### Spouse Lines (horizontal line)

```
x1 = husb.x + CARD_W
y1 = husb.y + CARD_H / 2
x2 = wife.x
y2 = wife.y + CARD_H / 2
```

#### Parent to Child Bezier (cubic path)

```
M startX startY          <- Marriage hub center
C startX cy,             <- Control point 1: directly below hub
  endX cy,               <- Control point 2: directly above child
  endX endY              <- Child card top-center

where:
  startX = marriageNode.x
  startY = marriageNode.y
  endX   = child.x + CARD_W / 2
  endY   = child.y
  cy     = (startY + endY) / 2   <- Symmetric midpoint -> smooth S-curve
```

### Export Architecture (html-to-image)

```
User clicks "Export"
       │
       ▼
toPng(canvasRef.current, { quality: 0.95, backgroundColor: '#E0E5EC' })
       │
       ├─ DOM-to-canvas serialization (no server round-trip)
       ├─ Privacy filter: .privacy-blur CSS applied to female avatars
       │  (backdrop-filter: blur(8px) — rendered into the PNG)
       ▼
dataURL → anchor.click() → native browser download
```

No server-side PDF generators needed — the browser handles the entire pipeline.

---

## 6. Read-Only Canvas & Auto-Layout Engine

### Layout Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `CARD_W` | 210px | Card width |
| `CARD_H` | 100px | Card height |
| `GAP_X` | 80px | Horizontal gap between siblings |
| `GAP_Y` | 280px | Vertical gap between generations |
| `SLOT_W` | 290px | `CARD_W + GAP_X` — minimum safe slot |
| `CANVAS_ORIGIN_X` | 2500px | Horizontal center anchor |
| `CANVAS_ORIGIN_Y` | 1800px | Top-row Y anchor |

### Algorithm Steps

```
1. BUILD CHILD MAP
   Map<marriageNodeId, FamilyMember[]> sorted by birth year ASC

2. IDENTIFY FOUNDERS
   members where assigned=true AND parentMarriageNode is undefined

3. COMPUTE SUBTREE WIDTHS (bottom-up recursion)
   getSubtreeWidth(m) = max(1, sum of getSubtreeWidth(child) for all children)
   Returns: integer number of SLOT_W columns

4. PLACE NODES (top-down DFS)
   founderCursorX = CANVAS_ORIGIN_X - (totalFounderWidth / 2)

   For each founder (left to right):
     member.x = founderCenterX
     member.y = CANVAS_ORIGIN_Y + (depth x GAP_Y)
     spouse.x = member.x + CARD_W + GAP_X
     spouse.y = member.y   <- same generation level, strictly

     for each child subtree:
       child.x = mnCenterX - totalWidth/2 + accumulated_offset
       child.y = member.y + GAP_Y

5. COMPUTE MARRIAGE NODE POSITIONS (post-placement)
   mn.x = (husb.x + wife.x) / 2 + CARD_W / 2
   mn.y = husb.y + CARD_H / 2
   (Centered precisely on the horizontal spouse line)
```

---

## 7. Time-Travel Simulator Logic

The timeline slider sets `activeYear: number`. Three visibility states:

| Member State | Condition | opacity | filter | pointerEvents |
|--------------|-----------|---------|--------|---------------|
| ALIVE | `birth <= year AND death >= year` | 1.0 | none | auto |
| DECEASED | `birth <= year AND death < year` | 0.62 | grayscale(70%) | none |
| NOT YET BORN | `birth > year` | 0.0 | none | none |

SVG line visibility:

- **Spouse line**: hidden if both spouses are not-yet-born; `opacity: 0.5` if both deceased
- **Parent-child bezier**: hidden (return null) if child is not-yet-born; `opacity: 0.5` if all deceased

Marriage hub node:

- Hidden if neither spouse is born yet
- `opacity: 0.5` if both spouses deceased
- `opacity: 1.0` if either spouse alive

---

## 8. Islamic Mahram Engine

`checkIsMahram(activeUserId, targetMemberId)` determines if target may have their privacy shield removed for the active viewer.

### Nasabi (Biological) Mahrams

```
Ancestors:          all parents, grandparents, great-grandparents, ...
Descendants:        all children, grandchildren, ...
Siblings:           children of same parents (excluding self)
Sibling desc.:      all children/grandchildren of each sibling
Ancestor siblings:  aunts and uncles
```

### Sababi (Marital) Mahrams

```
Spouses:            current/past wives or husbands
Ancestor spouses:   step-mothers, step-grandmothers, ...
Descendant spouses: sons-in-law, daughters-in-law, ...
Spouse ancestors:   mother-in-law, father-in-law, ...
Spouse descendants: step-children (from spouse's other marriages)
```

Both sets are computed via BFS on the in-memory adjacency graph built by `buildFamilyGraph()`.

---

## 9. Relationship Path-Finder

`findRelationship(userAId, userBId, lang)` returns a localized kinship label.

### Algorithm

1. Build family graph (same as mahram engine)
2. Run Breadth-First Search from `userAId` through all 4 edge types: parents, children, spouses, siblings
3. BFS guarantees the shortest path (minimum hops) between the two members
4. The path array (e.g. `[father, brother, son]`) is converted to string key `"father->brother->son"`
5. Key is looked up in the `faMap` / `arMap` exact-match tables
6. If no exact match, a dynamic genitive chain is composed

### Example Outputs

| Path | Persian (fa) | Arabic (ar) |
|------|-------------|-------------|
| `father` | پدر | أب |
| `father->father` | پدربزرگ پدری | جد لأب |
| `father->brother->son` | پسرعمو | ابن عم |
| `mother->sister->daughter` | دخترخاله | بنت خالة |
| `daughter->husband` | داماد | صهر (زوج الابنة) |

---

## 10. API Endpoints Reference

Base URL: `http://localhost:7781/v1`

### Members

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|-------------|----------|
| `GET` | `/members` | List all active members | — | `{ members: Member[] }` |
| `POST` | `/members` | Create new member | `CreateMemberDto` | `{ member: Member }` |
| `GET` | `/members/:id` | Get member by ID | — | `{ member: Member }` |
| `PUT` | `/members/:id` | Update member | `EditMemberDto` | `{ member: Member }` |
| `DELETE` | `/members/:id` | Soft-delete member | — | `{ success: true }` |

### Marriages

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|-------------|----------|
| `POST` | `/members/marriages` | Create marriage node | `{ spouseA, spouseB, children?, marriageDate? }` | `{ marriage: Marriage }` |
| `POST` | `/members/marriages/:id/children` | Add child to marriage | `{ childId }` | `{ marriage: Marriage }` |

### Utility Endpoints

| Method | Path | Description | Query Params | Response |
|--------|------|-------------|-------------|----------|
| `GET` | `/members/mahram-check` | Check mahram relationship | `activeUserId`, `targetMemberId` | `{ isMahram: boolean }` |
| `GET` | `/members/relationship` | Get kinship label | `userAId`, `userBId`, `lang?` (fa or ar) | `{ relationship: string }` |

> **Important — Route Order:** In `MembersController`, the `/mahram-check`, `/relationship`, and `/marriages` routes are declared **before** `/:id`. This is critical: NestJS routes are matched top-to-bottom, and without this ordering, `"mahram-check"` would be incorrectly captured as a member `:id` parameter.

### CreateMemberDto Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | First name |
| `lastName` | string | yes | Last name |
| `mobile` | string | yes | Auto-normalized via `@Transform` |
| `gender` | `'male'` or `'female'` | yes | |
| `birthday` | DateString | yes | ISO 8601 |
| `deathday` | DateString | no | Omit if living |
| `biography` | string | no | |
| `language` | `'fa'` or `'ar'` | no | Default: `'fa'` |
| `password` | string | no | Hashed before storage |
| `parentMarriageId` | string | no | Links to Marriage._id |
| `avatar` | string | no | Relative path under `/public/` |

---

## 11. Port Mapping

| Service | Development Port | Production Port | Notes |
|---------|----------------|----------------|-------|
| NestJS Backend | **7781** | 7781 | Configured in `main.ts` via `process.env.PORT` |
| Next.js Frontend | **3000** (dev) / **7782** (prod) | 7782 | `next start -p 7782` |
| MongoDB | 27017 | 27017 | Local or Atlas URI via `DATABASE_URL` env |

### CORS Configuration

Backend allows requests from:

```
FRONTEND_ORIGINS=http://localhost:7782,http://localhost:3000
```

Configured in `main.ts` via `app.enableCors({ origin: getCorsOrigins() })`.

### Environment Files

```
khandan-najaf-back/
  .env.development    # DATABASE_URL, PORT, FRONTEND_ORIGINS
  .env.production     # Production values
```

---

## Commenting Style Reference

All source files follow this segment header format:

```typescript
// --- Interfaces ----------------------------------------------------------------
// --- Redux ---------------------------------------------------------------------
// --- States --------------------------------------------------------------------
// --- Functions -----------------------------------------------------------------
// --- Lifecycle -----------------------------------------------------------------
// --- Render --------------------------------------------------------------------
```

---

*Generated: 2026-07-15 | Khandan Najaf Platform v1.0*
