"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import type * as THREE from "three"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Play, Shuffle, RotateCcw, Zap, Brain, Target, Pause, Camera } from "lucide-react"
import { Footer } from "@/components/footer"

// Color mapping from Python code
const COLORS = {
  0: "#0B0B3B", // BLACK
  1: "#FF0000", // RED (Tươi hơn)
  2: "#FFA500", // ORANGE (Tươi hơn)
  3: "#0000FF", // BLUE (Tươi hơn)
  4: "#00FF00", // GREEN (Tươi hơn)
  5: "#ffffff", // WHITE
  6: "#FFFF00", // YELLOW (Tươi hơn)
}

// Initial cube state from Python (solved state)
const INITIAL_CUBE = [
  6,
  6,
  6,
  6,
  6,
  6,
  6,
  6,
  6, // Yellow (Upper)
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3, // Blue (Left)
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1, // Red (Front)
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4, // Green (Right)
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2, // Orange (Behind)
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5, // White (Down)
]

// Edge and corner definitions from Python
const EDGES = [
  [7, 19], // uf up-front
  [3, 10], // ul up-left
  [5, 28], // ur up-right
  [1, 37], // ub up-back
  [21, 14], // fl front-left
  [23, 30], // fr front-right
  [41, 12], // bl back-left
  [39, 32], // br back-right
  [46, 25], // df down-front
  [48, 16], // dl down-left
  [50, 34], // dr down-right
  [52, 43], // db down back
]

const CORNERS = [
  [6, 18, 11], // ufl
  [8, 20, 27], // ufr
  [0, 38, 9], // ubl
  [2, 36, 29], // ubr
  [45, 24, 17], // dfl
  [47, 26, 33], // dfr
  [51, 44, 15], // dbl
  [53, 42, 35], // dbr
]

// Rotation matrices from Python
const CW = [6, 7, 0, 1, 2, 3, 4, 5, 17, 18, 19, 8, 9, 10, 11, 12, 13, 14, 15, 16]
const CWM = [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8]

// Create rotation matrices
const createRotationMatrix = (mapping: number[]) => {
  const matrix = Array(mapping.length)
    .fill(null)
    .map(() => Array(mapping.length).fill(0))
  for (let i = 0; i < mapping.length; i++) {
    matrix[i][mapping[i]] = 1
  }
  return matrix
}

const matrixRotCw = createRotationMatrix(CW)
const matrixRotCcw = matrixRotCw[0].map((_, colIndex) => matrixRotCw.map((row) => row[colIndex]))
const matrixRotMidCw = createRotationMatrix(CWM)
const matrixRotMidCcw = matrixRotMidCw[0].map((_, colIndex) => matrixRotMidCw.map((row) => row[colIndex]))

// Rotation mappings from Python
const rotU = [0, 1, 2, 5, 8, 7, 6, 3, 38, 37, 36, 29, 28, 27, 20, 19, 18, 11, 10, 9]
const rotD = [45, 46, 47, 50, 53, 52, 51, 48, 24, 25, 26, 33, 34, 35, 42, 43, 44, 15, 16, 17]
const rotF = [18, 19, 20, 23, 26, 25, 24, 21, 6, 7, 8, 27, 30, 33, 47, 46, 45, 17, 14, 11]
const rotB = [36, 37, 38, 41, 44, 43, 42, 39, 2, 1, 0, 9, 12, 15, 51, 52, 53, 35, 32, 29]
const rotR = [27, 28, 29, 32, 35, 34, 33, 30, 8, 5, 2, 36, 39, 42, 53, 50, 47, 26, 23, 20]
const rotL = [9, 10, 11, 14, 17, 16, 15, 12, 0, 3, 6, 18, 21, 24, 45, 48, 51, 44, 41, 38]
const rotE = [12, 13, 14, 21, 22, 23, 30, 31, 32, 39, 40, 41]
const rotM = [37, 40, 43, 52, 49, 46, 25, 22, 19, 7, 4, 1]
const rotS = [3, 4, 5, 28, 31, 34, 50, 49, 48, 16, 13, 10]

const rotA = [rotU, rotD, rotF, rotB, rotR, rotL]
const rotC = [rotM, rotE, rotS]

// Matrix multiplication helper
const matrixMultiply = (matrix: number[][], vector: number[]) => {
  return matrix.map((row) => row.reduce((sum, val, i) => sum + val * vector[i], 0))
}

// Individual cube piece component
function CubePiece({
  position,
  colors,
  scale = 0.48,
}: {
  position: [number, number, number]
  colors: number[]
  scale?: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      {colors.map((color, index) => (
        <meshStandardMaterial
          key={index}
          attach={`material-${index}`}
          color={COLORS[color as keyof typeof COLORS]}
          metalness={0.1}
          roughness={0.3}
        />
      ))}
    </mesh>
  )
}

// Main Rubik's cube 3D component
function RubiksCube({ cubeState }: { cubeState: number[] }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.05
    }
  })

  const getCubeColors = (x: number, y: number, z: number) => {
    const colors = [0, 0, 0, 0, 0, 0] // Default black
    const xIndex = x + 1
    const yIndex = y + 1
    const zIndex = z + 1

    // Map cube positions to face indices based on Python logic
    if (y === 1) colors[2] = cubeState[xIndex + zIndex * 3] // Top (Yellow)
    if (y === -1) colors[3] = cubeState[45 + xIndex + zIndex * 3] // Bottom (White)
    if (z === 1) colors[4] = cubeState[18 + xIndex + (1 - y) * 3] // Front (Red)
    if (z === -1) colors[5] = cubeState[36 + xIndex + (1 - y) * 3] // Back (Orange)
    if (x === 1) colors[0] = cubeState[27 + zIndex + (1 - y) * 3] // Right (Green)
    if (x === -1) colors[1] = cubeState[9 + zIndex + (1 - y) * 3] // Left (Blue)

    return colors
  }

  return (
    <group ref={groupRef}>
      {[-1, 0, 1].map((x) =>
        [-1, 0, 1].map((y) =>
          [-1, 0, 1].map((z) => (
            <CubePiece key={`${x}-${y}-${z}`} position={[x * 1.1, y * 1.1, z * 1.1]} colors={getCubeColors(x, y, z)} />
          )),
        ),
      )}
    </group>
  )
}

// Complete Rubik's cube solver class (converted from Python)
class RubiksSolver {
  cube: number[]
  countStep: number
  delayMs: number // Renamed from speedRotation to delayMs

  constructor(initialState: number[], initialDelayMs = 100) {
    this.cube = [...initialState]
    this.countStep = 0
    this.delayMs = initialDelayMs
  }

  // cwNccw function from Python
  cwNccw(key: number, direction: number) {
    const T = new Array(20)
    for (let i = 0; i < 20; i++) {
      T[i] = this.cube[rotA[key][i]]
    }

    let result: number[]
    if (direction === 0) {
      result = matrixMultiply(matrixRotCw, T)
    } else if (direction === 1) {
      result = matrixMultiply(matrixRotCcw, T)
    } else {
      result = matrixMultiply(matrixRotCw, matrixMultiply(matrixRotCw, T))
    }

    for (let i = 0; i < 20; i++) {
      this.cube[rotA[key][i]] = result[i]
    }
  }

  // cwNccwMid function from Python
  cwNccwMid(key: number, direction: number) {
    const T = new Array(12)
    for (let i = 0; i < 12; i++) {
      T[i] = this.cube[rotC[key][i]]
    }

    let result: number[]
    if (direction === 0) {
      result = matrixMultiply(matrixRotMidCw, T)
    } else if (direction === 1) {
      result = matrixMultiply(matrixRotMidCcw, T)
    } else {
      result = matrixMultiply(matrixRotMidCw, matrixMultiply(matrixRotMidCw, T))
    }

    for (let i = 0; i < 12; i++) {
      this.cube[rotC[key][i]] = result[i]
    }
  }

  // rot2D function from Python
  rot2D(key: string) {
    let direction = 0
    if (key.length > 1) {
      if (key[1] === "'") {
        direction = 1
      } else {
        direction = 2
      }
    }

    switch (key[0]) {
      case "U":
        this.cwNccw(0, direction)
        break
      case "D":
        this.cwNccw(1, direction)
        break
      case "F":
        this.cwNccw(2, direction)
        break
      case "B":
        this.cwNccw(3, direction)
        break
      case "R":
        this.cwNccw(4, direction)
        break
      case "L":
        this.cwNccw(5, direction)
        break
      case "M":
        this.cwNccwMid(0, direction)
        break
      case "E":
        this.cwNccwMid(1, direction)
        break
      case "S":
        this.cwNccwMid(2, direction)
        break
    }
  }

  // algorithm function from Python
  async algorithm(algo: string, onStep?: (step: string) => void, checkPause?: () => Promise<void>): Promise<void> {
    const steps = algo.split(" ")

    for (const step of steps) {
      if (step.trim()) {
        if (checkPause) await checkPause() // Check for pause before each step
        await new Promise((resolve) => setTimeout(resolve, this.delayMs))
        this.rot2D(step)
        this.countStep++
        if (onStep) onStep(step)
      }
    }
  }

  // randomRot function from Python
  generateScramble(): string {
    const ff = ["U", "D", "R", "L", "F", "B"]
    const gg = ["", "'", "2"]
    let scramble = ""
    let g = 999
    let t = 0

    while (t < 25) {
      const i = Math.floor(Math.random() * 6)
      const j = Math.floor(Math.random() * 3)
      if (i !== g) {
        const tx = ff[i] + gg[j]
        scramble += tx + " "
        g = i
        t++
      }
    }

    return scramble.trim()
  }

  // whiteCross function from Python
  async whiteCross(onStep?: (step: string) => void, checkPause?: () => Promise<void>): Promise<void> {
    const listf = [2, 4, 1, 3] // cam-xanhlá-đỏ-xanhbiển

    for (const i of listf) {
      if (this.cube[EDGES[11][0]] === i && this.cube[EDGES[11][1]] === 5) {
        await this.algorithm("B R' U' R B2", onStep, checkPause)
      } else if (this.cube[EDGES[0][0]] === i && this.cube[EDGES[0][1]] === 5) {
        await this.algorithm("U2 B' R' U' R B2", onStep, checkPause)
      } else if (this.cube[EDGES[0][0]] === 5 && this.cube[EDGES[0][1]] === i) {
        await this.algorithm("U2 B2", onStep, checkPause)
      } else if (this.cube[EDGES[1][0]] === i && this.cube[EDGES[1][1]] === 5) {
        await this.algorithm("U B' R' U' R B2", onStep, checkPause)
      } else if (this.cube[EDGES[1][0]] === 5 && this.cube[EDGES[1][1]] === i) {
        await this.algorithm("U B2", onStep, checkPause)
      } else if (this.cube[EDGES[2][0]] === i && this.cube[EDGES[2][1]] === 5) {
        await this.algorithm("U' B' R' U' R B2", onStep, checkPause)
      } else if (this.cube[EDGES[2][0]] === 5 && this.cube[EDGES[2][1]] === i) {
        await this.algorithm("U' B2", onStep, checkPause)
      } else if (this.cube[EDGES[3][0]] === i && this.cube[EDGES[3][1]] === 5) {
        await this.algorithm("B' R' U' R B2", onStep, checkPause)
      } else if (this.cube[EDGES[3][0]] === 5 && this.cube[EDGES[3][1]] === i) {
        await this.algorithm("B2", onStep, checkPause)
      } else if (this.cube[EDGES[4][0]] === i && this.cube[EDGES[4][1]] === 5) {
        await this.algorithm("L2 B L2", onStep, checkPause)
      } else if (this.cube[EDGES[4][0]] === 5 && this.cube[EDGES[4][1]] === i) {
        await this.algorithm("D L D'", onStep, checkPause)
      } else if (this.cube[EDGES[5][0]] === i && this.cube[EDGES[5][1]] === 5) {
        await this.algorithm("R2 B' R2", onStep, checkPause)
      } else if (this.cube[EDGES[5][0]] === 5 && this.cube[EDGES[5][1]] === i) {
        await this.algorithm("D' R' D", onStep, checkPause)
      } else if (this.cube[EDGES[6][0]] === i && this.cube[EDGES[6][1]] === 5) {
        await this.algorithm("B", onStep, checkPause)
      } else if (this.cube[EDGES[6][0]] === 5 && this.cube[EDGES[6][1]] === i) {
        await this.algorithm("L U L' B2", onStep, checkPause)
      } else if (this.cube[EDGES[7][0]] === i && this.cube[EDGES[7][1]] === 5) {
        await this.algorithm("B'", onStep, checkPause)
      } else if (this.cube[EDGES[7][0]] === 5 && this.cube[EDGES[7][1]] === i) {
        await this.algorithm("R' U' R B2", onStep, checkPause)
      } else if (this.cube[EDGES[8][0]] === i && this.cube[EDGES[8][1]] === 5) {
        await this.algorithm("F2 U2 B' R' U' R B2", onStep, checkPause)
      } else if (this.cube[EDGES[8][0]] === 5 && this.cube[EDGES[8][1]] === i) {
        await this.algorithm("F2 U2 B2", onStep, checkPause)
      } else if (this.cube[EDGES[9][0]] === i && this.cube[EDGES[9][1]] === 5) {
        await this.algorithm("L B", onStep, checkPause)
      } else if (this.cube[EDGES[9][0]] === 5 && this.cube[EDGES[9][1]] === i) {
        await this.algorithm("L2 U B2", onStep, checkPause)
      } else if (this.cube[EDGES[10][0]] === i && this.cube[EDGES[10][1]] === 5) {
        await this.algorithm("R' B'", onStep, checkPause)
      } else if (this.cube[EDGES[10][0]] === 5 && this.cube[EDGES[10][1]] === i) {
        await this.algorithm("R2 U' B2", onStep, checkPause)
      }
      await this.algorithm("D", onStep, checkPause)
    }
  }

  // whiteFull function from Python
  async whiteFull(onStep?: (step: string) => void, checkPause?: () => Promise<void>): Promise<void> {
    const lists = [4, 3, 6, 8]

    for (const i of lists) {
      if (this.cube[CORNERS[0][0]] === 5 && this.cube[CORNERS[0][1]] * this.cube[CORNERS[0][2]] === i) {
        await this.algorithm("U' R U' R' F' U2 F", onStep, checkPause)
      } else if (this.cube[CORNERS[0][1]] === 5 && this.cube[CORNERS[0][0]] * this.cube[CORNERS[0][2]] === i) {
        await this.algorithm("U F' U2 F", onStep, checkPause)
      } else if (this.cube[CORNERS[0][2]] === 5 && this.cube[CORNERS[0][0]] * this.cube[CORNERS[0][1]] === i) {
        await this.algorithm("R U' R'", onStep, checkPause)
      } else if (this.cube[CORNERS[1][0]] === 5 && this.cube[CORNERS[1][1]] * this.cube[CORNERS[1][2]] === i) {
        await this.algorithm("R U' R' F' U2 F", onStep, checkPause)
      } else if (this.cube[CORNERS[1][1]] === 5 && this.cube[CORNERS[1][0]] * this.cube[CORNERS[1][2]] === i) {
        await this.algorithm("U R U' R'", onStep, checkPause)
      } else if (this.cube[CORNERS[1][2]] === 5 && this.cube[CORNERS[1][0]] * this.cube[CORNERS[1][1]] === i) {
        await this.algorithm("U' F' U F", onStep, checkPause)
      } else if (this.cube[CORNERS[2][0]] === 5 && this.cube[CORNERS[2][1]] * this.cube[CORNERS[2][2]] === i) {
        await this.algorithm("U2 R U' R' F' U2 F", onStep, checkPause)
      } else if (this.cube[CORNERS[2][1]] === 5 && this.cube[CORNERS[2][0]] * this.cube[CORNERS[2][2]] === i) {
        await this.algorithm("R U2 R'", onStep, checkPause)
      } else if (this.cube[CORNERS[2][2]] === 5 && this.cube[CORNERS[2][0]] * this.cube[CORNERS[2][1]] === i) {
        await this.algorithm("F' U2 F", onStep, checkPause)
      } else if (this.cube[CORNERS[3][0]] === 5 && this.cube[CORNERS[3][1]] * this.cube[CORNERS[3][2]] === i) {
        await this.algorithm("U R U' R' F' U2 F", onStep, checkPause)
      } else if (this.cube[CORNERS[3][1]] === 5 && this.cube[CORNERS[3][0]] * this.cube[CORNERS[3][2]] === i) {
        await this.algorithm("F' U F", onStep, checkPause)
      } else if (this.cube[CORNERS[3][2]] === 5 && this.cube[CORNERS[3][0]] * this.cube[CORNERS[3][1]] === i) {
        await this.algorithm("U' R U2 R'", onStep, checkPause)
      } else if (this.cube[CORNERS[4][0]] === 5 && this.cube[CORNERS[4][1]] * this.cube[CORNERS[4][2]] === i) {
        await this.algorithm("F U F' R U2 R'", onStep, checkPause)
      } else if (this.cube[CORNERS[4][1]] === 5 && this.cube[CORNERS[4][0]] * this.cube[CORNERS[4][2]] === i) {
        await this.algorithm("F U F2 U2 F", onStep, checkPause)
      } else if (this.cube[CORNERS[4][2]] === 5 && this.cube[CORNERS[4][0]] * this.cube[CORNERS[4][1]] === i) {
        await this.algorithm("F U' F' R U' R'", onStep, checkPause) // Corrected algorithm
      } else if (this.cube[CORNERS[5][0]] === 5 && this.cube[CORNERS[5][1]] * this.cube[CORNERS[5][2]] === i) {
        // pass
      } else if (this.cube[CORNERS[5][1]] === 5 && this.cube[CORNERS[5][0]] * this.cube[CORNERS[5][2]] === i) {
        await this.algorithm("F' U2 F R U2 R'", onStep, checkPause)
      } else if (this.cube[CORNERS[5][2]] === 5 && this.cube[CORNERS[5][0]] * this.cube[CORNERS[5][1]] === i) {
        await this.algorithm("F' U F U' F' U F", onStep, checkPause)
      } else if (this.cube[CORNERS[6][0]] === 5 && this.cube[CORNERS[6][1]] * this.cube[CORNERS[6][2]] === i) {
        await this.algorithm("B' U B R U2 R'", onStep, checkPause)
      } else if (this.cube[CORNERS[6][1]] === 5 && this.cube[CORNERS[6][0]] * this.cube[CORNERS[6][2]] === i) {
        await this.algorithm("B' U' B R U' R'", onStep, checkPause)
      } else if (this.cube[CORNERS[6][2]] === 5 && this.cube[CORNERS[6][0]] * this.cube[CORNERS[6][1]] === i) {
        await this.algorithm("B' U B F' U2 F", onStep, checkPause)
      } else if (this.cube[CORNERS[7][0]] === 5 && this.cube[CORNERS[7][1]] * this.cube[CORNERS[7][2]] === i) {
        await this.algorithm("B U B' U R U' R'", onStep, checkPause)
      } else if (this.cube[CORNERS[7][1]] === 5 && this.cube[CORNERS[7][0]] * this.cube[CORNERS[7][2]] === i) {
        await this.algorithm("R' U R F' U F", onStep, checkPause)
      } else if (this.cube[CORNERS[7][2]] === 5 && this.cube[CORNERS[7][0]] * this.cube[CORNERS[7][1]] === i) {
        await this.algorithm("R' U' R2 U2 R'", onStep, checkPause)
      }
      await this.algorithm("D", onStep, checkPause)
    }
  }

  // secondLayer function from Python
  async secondLayer(onStep?: (step: string) => void, checkPause?: () => Promise<void>): Promise<void> {
    const lists = [1, 3, 2, 4]
    const lists1 = [4, 1, 3, 2]

    for (let i = 0; i < 4; i++) {
      const k = lists[i]
      const j = lists1[i]

      if (this.cube[EDGES[0][0]] === k && this.cube[EDGES[0][1]] === j) {
        await this.algorithm("U2 F' U F U R U' R'", onStep, checkPause)
      } else if (this.cube[EDGES[0][0]] === j && this.cube[EDGES[0][1]] === k) {
        await this.algorithm("U R U' R' U' F' U F", onStep, checkPause)
      } else if (this.cube[EDGES[1][0]] === k && this.cube[EDGES[1][1]] === j) {
        await this.algorithm("U F' U F U R U' R'", onStep, checkPause)
      } else if (this.cube[EDGES[1][0]] === j && this.cube[EDGES[1][1]] === k) {
        await this.algorithm("R U' R' U' F' U F", onStep, checkPause)
      } else if (this.cube[EDGES[2][0]] === k && this.cube[EDGES[2][1]] === j) {
        await this.algorithm("U' F' U F U R U' R'", onStep, checkPause)
      } else if (this.cube[EDGES[2][0]] === j && this.cube[EDGES[2][1]] === k) {
        await this.algorithm("U2 R U' R' U' F' U F", onStep, checkPause)
      } else if (this.cube[EDGES[3][0]] === k && this.cube[EDGES[3][1]] === j) {
        await this.algorithm("F' U F U R U' R'", onStep, checkPause)
      } else if (this.cube[EDGES[3][0]] === j && this.cube[EDGES[3][1]] === k) {
        await this.algorithm("U' R U' R' U' F' U F", onStep, checkPause)
      } else if (this.cube[EDGES[4][0]] === k && this.cube[EDGES[4][1]] === j) {
        await this.algorithm("F U' F' U' L' U L U2 R U' R' U' F' U F", onStep, checkPause)
      } else if (this.cube[EDGES[4][0]] === j && this.cube[EDGES[4][1]] === k) {
        await this.algorithm("F U' F' U' L' U L U' F' U F U R U' R'", onStep, checkPause)
      } else if (this.cube[EDGES[5][0]] === k && this.cube[EDGES[5][1]] === j) {
        // pass
      } else if (this.cube[EDGES[5][0]] === j && this.cube[EDGES[5][1]] === k) {
        await this.algorithm("R U' R' U' F' U F U' R U' R' U' F' U F", onStep, checkPause)
      } else if (this.cube[EDGES[6][0]] === k && this.cube[EDGES[6][1]] === j) {
        await this.algorithm("L U' L' U' B' U B U2 F' U F U R U' R'", onStep, checkPause)
      } else if (this.cube[EDGES[6][0]] === j && this.cube[EDGES[6][1]] === k) {
        await this.algorithm("L U' L' U' B' U B U R U' R' U' F' U F", onStep, checkPause)
      } else if (this.cube[EDGES[7][0]] === k && this.cube[EDGES[7][1]] === j) {
        await this.algorithm("R' U R U B U' B' U2 F' U F U R U' R'", onStep, checkPause)
      } else if (this.cube[EDGES[7][0]] === j && this.cube[EDGES[7][1]] === k) {
        await this.algorithm("R' U R U B U' B' U R U' R' U' F' U F", onStep, checkPause)
      }
      await this.algorithm("E D", onStep, checkPause)
    }
  }

  // oll2look function from Python
  async oll2look(onStep?: (step: string) => void, checkPause?: () => Promise<void>): Promise<void> {
    // Cross yellow
    if (this.cube[1] !== 6 && this.cube[3] !== 6 && this.cube[5] !== 6 && this.cube[7] !== 6) {
      await this.algorithm("F R U R' U' F' F S R U R' U' F' S'", onStep, checkPause)
    } else if (this.cube[1] === 6 && this.cube[3] !== 6 && this.cube[5] !== 6 && this.cube[7] === 6) {
      await this.algorithm("U F R U R' U' F'", onStep, checkPause)
    } else if (this.cube[1] !== 6 && this.cube[3] === 6 && this.cube[5] === 6 && this.cube[7] !== 6) {
      await this.algorithm("F R U R' U' F'", onStep, checkPause)
    } else if (this.cube[1] === 6 && this.cube[3] === 6 && this.cube[5] !== 6 && this.cube[7] !== 6) {
      await this.algorithm("U2 F S R U R' U' F' S'", onStep, checkPause)
    } else if (this.cube[1] === 6 && this.cube[3] !== 6 && this.cube[5] === 6 && this.cube[7] !== 6) {
      await this.algorithm("U F S R U R' U' F' S'", onStep, checkPause)
    } else if (this.cube[1] !== 6 && this.cube[3] === 6 && this.cube[5] !== 6 && this.cube[7] === 6) {
      await this.algorithm("U' F S R U R' U' F' S'", onStep, checkPause)
    } else if (this.cube[1] !== 6 && this.cube[3] !== 6 && this.cube[5] === 6 && this.cube[7] === 6) {
      await this.algorithm("F S R U R' U' F' S'", onStep, checkPause)
    }

    let countY = 0
    for (const i of [0, 2, 6, 8]) {
      if (this.cube[i] === 6) {
        countY++
      }
    }

    // Pi and H
    if (countY === 0) {
      // H
      if (
        this.cube[9] === 6 &&
        this.cube[11] === 6 &&
        this.cube[18] !== 6 &&
        this.cube[20] !== 6 &&
        this.cube[27] === 6 &&
        this.cube[29] === 6 &&
        this.cube[36] !== 6 &&
        this.cube[38] !== 6
      ) {
        await this.algorithm("R U R' U R U2 R'", onStep, checkPause) // Corrected algorithm
      } else if (
        this.cube[9] !== 6 &&
        this.cube[11] !== 6 &&
        this.cube[18] === 6 &&
        this.cube[20] === 6 &&
        this.cube[27] !== 6 &&
        this.cube[29] !== 6 &&
        this.cube[36] === 6 &&
        this.cube[38] === 6
      ) {
        await this.algorithm("U R U R' U R U' R' U R U2 R'", onStep, checkPause)
      } else {
        // Pi
        for (let i = 0; i < 4; i++) {
          if (
            this.cube[9] === 6 &&
            this.cube[11] === 6 &&
            this.cube[18] !== 6 &&
            this.cube[20] === 6 &&
            this.cube[27] !== 6 &&
            this.cube[29] !== 6 &&
            this.cube[36] === 6 &&
            this.cube[38] !== 6
          ) {
            await this.algorithm("R U2 R2 U' R2 U' R2 U2 R", onStep, checkPause)
            break
          } else {
            await this.algorithm("U", onStep, checkPause)
          }
        }
      }
    }
    // Sune and antisune
    else if (countY === 1) {
      for (let i = 0; i < 4; i++) {
        // Sune
        if (this.cube[6] === 6 && this.cube[20] === 6) {
          await this.algorithm("R U R' U R U2 R'", onStep, checkPause)
          break
        }
        // Anti sune
        else if (this.cube[2] === 6 && this.cube[18] === 6) {
          await this.algorithm("R U2 R' U' R U' R'", onStep, checkPause)
          break
        } else {
          await this.algorithm("U", onStep, checkPause)
        }
      }
    }
    // L, T and U
    else if (countY === 2) {
      for (let i = 0; i < 4; i++) {
        // L
        if (this.cube[0] === 6 && this.cube[8] === 6 && this.cube[18] === 6 && this.cube[29] === 6) {
          await this.algorithm("F R' F' R M U R U' R' M'", onStep, checkPause)
          break
        } else if (this.cube[0] === 6 && this.cube[8] === 6 && this.cube[11] === 6 && this.cube[36] === 6) {
          await this.algorithm("U2 F R' F' R M U R U' R' M'", onStep, checkPause)
          break
        }
        // T
        else if (this.cube[2] === 6 && this.cube[8] === 6 && this.cube[18] === 6 && this.cube[38] === 6) {
          await this.algorithm("R M U R' U' R' M' F R F'", onStep, checkPause)
          break
        }
        // U
        else if (this.cube[0] === 6 && this.cube[2] === 6 && this.cube[18] === 6 && this.cube[20] === 6) {
          await this.algorithm("R2 D R' U2 R D' R' U2 R'", onStep, checkPause)
          break
        } else {
          await this.algorithm("U", onStep, checkPause)
        }
      }
    }
  }

  // pll2look function from Python
  async pll2look(onStep?: (step: string) => void, checkPause?: () => Promise<void>): Promise<void> {
    if (this.cube[10] === 1) {
      await this.algorithm("U'", onStep, checkPause)
    } else if (this.cube[28] === 1) {
      await this.algorithm("U", onStep, checkPause)
    } else if (this.cube[37] === 1) {
      await this.algorithm("U2", onStep, checkPause)
    }

    // Corner
    const list1 = [
      [1, 2, 3],
      [3, 0, 2],
      [0, 3, 1],
      [2, 1, 0],
    ]
    const lists = [3, 4, 6, 8]
    const liste = [0, 0, 0, 0]

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (this.cube[CORNERS[i][1]] * this.cube[CORNERS[i][2]] === lists[j]) {
          liste[i] = j
        }
      }
    }

    await this.algorithm("U'", onStep, checkPause)

    for (const i of [0, 1, 3, 2]) {
      if (liste[i] !== i) {
        if (liste[list1[i][0]] === i) {
          await this.algorithm("R U R' U' R' F R2 U' R' U' R U R' F'", onStep, checkPause)
          liste[list1[i][0]] = liste[i]
          liste[i] = i
          await this.algorithm("U", onStep, checkPause)
        } else if (liste[list1[i][1]] === i) {
          await this.algorithm("U' R U R' U' R' F R2 U' R' U' R U R' F' U", onStep, checkPause)
          liste[list1[i][1]] = liste[i]
          liste[i] = i
          await this.algorithm("U", onStep, checkPause)
        } else if (liste[list1[i][2]] === i) {
          await this.algorithm("F R U' R' U' R U R' F' R U R' U' R' F R F'", onStep, checkPause)
          liste[list1[i][2]] = liste[i]
          liste[i] = i
          await this.algorithm("U", onStep, checkPause)
        }
      } else {
        await this.algorithm("U", onStep, checkPause)
      }
    }

    if (this.cube[9] === 1) {
      await this.algorithm("U'", onStep, checkPause)
    } else if (this.cube[27] === 1) {
      await this.algorithm("U", onStep, checkPause)
    } else if (this.cube[36] === 1) {
      await this.algorithm("U2", onStep, checkPause)
    }

    // Edge
    const el = [10, 19, 28, 37]
    const elc = [3, 1, 4, 2]
    const elc1 = [0, 0, 0, 0]
    let ca = 0

    for (let i = 0; i < 4; i++) {
      elc1[i] = this.cube[el[i]]
      if (this.cube[el[i]] === elc[i]) {
        ca++
      }
    }

    if (ca === 0) {
      if (elc1[0] === 4) {
        await this.algorithm("M2 U M2 U2 M2 U M2", onStep, checkPause)
      } else if (elc1[0] === 2) {
        await this.algorithm("U' M' U M2 U M2 U M' U2 M2 U", onStep, checkPause)
      } else {
        await this.algorithm("M' U M2 U M2 U M' U2 M2", onStep, checkPause)
      }
    } else if (ca === 1) {
      const algox = ["U", "U2", "U'", ""]
      const algoy = ["U'", "U2", "U", ""]
      const fx = [2, 3, 1, 4]
      const fy = [2, 3, 0, 1]

      for (let i = 0; i < 4; i++) {
        if (elc1[i] === elc[i]) {
          if (algox[i] !== "") {
            await this.algorithm(algox[i], onStep, checkPause)
          }
          if (elc1[fy[i]] === fx[i]) {
            await this.algorithm("R U' R U R U R U' R' U' R2", onStep, checkPause) // Corrected algorithm
            if (algoy[i] !== "") {
              await this.algorithm(algoy[i], onStep, checkPause)
            }
            break
          } else {
            await this.algorithm("R2 U R U R' U' R' U' R' U R'", onStep, checkPause)
            if (algoy[i] !== "") {
              await this.algorithm(algoy[i], onStep, checkPause)
            }
            break
          }
        }
      }
    }

    if (this.cube[9] === 1) {
      await this.algorithm("U'", onStep, checkPause)
    } else if (this.cube[27] === 1) {
      await this.algorithm("U", onStep, checkPause)
    } else if (this.cube[36] === 1) {
      await this.algorithm("U2", onStep, checkPause)
    }
  }

  // Complete solve function
  async solve(onStep?: (step: string, phase: string) => void, checkPause?: () => Promise<void>): Promise<void> {
    this.countStep = 0

    // White Cross
    await this.whiteCross((step) => onStep?.(step, "White Cross"), checkPause)

    // First Layer
    await this.whiteFull((step) => onStep?.(step, "First Layer"), checkPause)

    // Second Layer
    await this.secondLayer((step) => onStep?.(step, "Second Layer"), checkPause)

    // OLL
    await this.oll2look((step) => onStep?.(step, "OLL"), checkPause)

    // PLL
    await this.pll2look((step) => onStep?.(step, "PLL"), checkPause)
  }
}

export default function RubikSolverApp() {
  const [cubeState, setCubeState] = useState<number[]>(INITIAL_CUBE)
  const [isScrambling, setIsScrambling] = useState(false)
  const [isSolving, setIsSolving] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentStep, setCurrentStep] = useState("")
  const [currentPhase, setCurrentPhase] = useState("")
  const [progress, setProgress] = useState(0)
  const [moveHistory, setMoveHistory] = useState<string[]>([])
  const [solveTime, setSolveTime] = useState<number | null>(null)
  const [totalSteps, setTotalSteps] = useState(0)
  const [speed, setSpeed] = useState<number>(10)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)

  const solver = useRef(new RubiksSolver(INITIAL_CUBE, 1000 / 10))
  const activeOperationRef = useRef<string | null>(null)
  const isPausedRef = useRef(isPaused)
  const canvasRef = useRef<HTMLCanvasElement>(null) // Ref cho Canvas

  // Update isPausedRef whenever isPaused state changes
  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  // Update solver delay when speed state changes
  useEffect(() => {
    solver.current.delayMs = 1000 / speed
  }, [speed])

  const updateCubeState = useCallback(() => {
    setCubeState([...solver.current.cube])
  }, [])

  // Helper to wait if paused, and also check if the operation is still active
  const checkPauseState = useCallback(async () => {
    while (isPausedRef.current && activeOperationRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 100)) // Wait a bit before re-checking
    }
    // If activeOperationRef.current becomes null while paused, it means the operation was reset/cancelled
    if (!activeOperationRef.current) {
      throw new Error("Operation cancelled") // Propagate cancellation
    }
  }, []) // No dependencies needed here, as it reads from refs

  const scrambleCube = useCallback(async () => {
    if (isScrambling || isSolving) return // Prevent multiple operations
    setIsScrambling(true)
    setIsSolving(false) // Ensure solving is false
    setIsPaused(false) // Reset pause state
    setProgress(0)
    setMoveHistory([])
    setCurrentPhase("Scrambling")
    setSolveTime(null)
    activeOperationRef.current = "scramble" // Mark current operation

    const scramble = solver.current.generateScramble()
    const steps = scramble.split(" ")

    try {
      for (let i = 0; i < steps.length; i++) {
        await checkPauseState() // Check pause before each step

        // If the current operation is no longer 'scramble', break the loop
        if (activeOperationRef.current !== "scramble") {
          break
        }

        await new Promise((resolve) => setTimeout(resolve, solver.current.delayMs)) // Use dynamic delay
        solver.current.rot2D(steps[i])
        updateCubeState()
        setCurrentStep(`${steps[i]}`)
        setProgress(((i + 1) / steps.length) * 100)
        setMoveHistory((prev) => [...prev, steps[i]])
      }
    } catch (error) {
      if (error instanceof Error && error.message === "Operation cancelled") {
        // console.log("Scramble operation cancelled.")
      } else {
        console.error("Error during scrambling:", error)
      }
    } finally {
      if (activeOperationRef.current === "scramble") {
        // Only update if this operation was still active
        setIsScrambling(false)
        setCurrentStep("Scrambled!")
        setCurrentPhase("")
      }
      activeOperationRef.current = null // Clear operation ref
    }
  }, [isScrambling, isSolving, checkPauseState, updateCubeState])

  const solveCube = useCallback(async () => {
    if (isScrambling || isSolving) return
    setIsSolving(true)
    setIsScrambling(false) // Ensure scrambling is false
    setIsPaused(false) // Reset pause state
    setProgress(0)
    setMoveHistory([])
    const startTime = Date.now()
    let stepCount = 0
    let currentPhaseSteps = 0
    let phaseProgress = 0

    const phases = ["White Cross", "First Layer", "Second Layer", "OLL", "PLL"]
    let currentPhaseIndex = 0
    activeOperationRef.current = "solve" // Mark current operation

    try {
      await solver.current.solve(
        (step, phase) => {
          if (activeOperationRef.current !== "solve") return // If operation changed, don't update UI

          if (phase !== currentPhase) {
            setCurrentPhase(phase)
            currentPhaseIndex = phases.indexOf(phase)
            currentPhaseSteps = 0
          }

          stepCount++
          currentPhaseSteps++
          updateCubeState()
          setCurrentStep(`${step}`)
          setMoveHistory((prev) => [...prev, step])

          // Calculate progress based on phase
          phaseProgress = (currentPhaseIndex / phases.length) * 100 + (currentPhaseSteps / 20) * (100 / phases.length)
          setProgress(Math.min(phaseProgress, 100))
        },
        checkPauseState, // Pass the checkPauseState function
      )
    } catch (error) {
      if (error instanceof Error && error.message === "Operation cancelled") {
        // console.log("Solve operation cancelled.")
      } else {
        console.error("Error during solving:", error)
      }
    } finally {
      if (activeOperationRef.current === "solve") {
        // Only update if this operation was still active
        const endTime = Date.now()
        setSolveTime((endTime - startTime) / 1000)
        setTotalSteps(solver.current.countStep)
        setIsSolving(false)
        setCurrentStep("Solved!")
        setCurrentPhase("")
        setProgress(100)
      }
      activeOperationRef.current = null // Clear operation ref
    }
  }, [isScrambling, isSolving, checkPauseState, updateCubeState, currentPhase])

  const resetCube = useCallback(() => {
    activeOperationRef.current = null // Immediately stop any active operation
    solver.current = new RubiksSolver(INITIAL_CUBE, 1000 / speed) // Re-initialize with current speed
    setCubeState(INITIAL_CUBE)
    setCurrentStep("")
    setCurrentPhase("")
    setProgress(0)
    setMoveHistory([])
    setSolveTime(null)
    setTotalSteps(0)
    setIsPaused(false) // Ensure pause is reset
    setIsScrambling(false) // Ensure scrambling is reset
    setIsSolving(false) // Ensure solving is reset
  }, [speed])

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev)
  }, [])

  const glRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.Camera | null>(null)

 const captureAndUploadCubeImage = async () => {
  const gl = glRef.current
  const scene = sceneRef.current
  const camera = cameraRef.current

  if (!gl || !scene || !camera) return

  gl.setClearColor("#1c222b", 1)
  gl.render(scene, camera)

  const dataURL = gl.domElement.toDataURL("image/png")
  const blob = await fetch(dataURL).then(res => res.blob())

  const formData = new FormData()
  formData.append("file", blob, "latest-rubik-state.png")

  const res = await fetch("/api/capture-cube", {
    method: "POST",
    body: JSON.stringify({ imageData: dataURL }),
    headers: { "Content-Type": "application/json" },
  })

  const data = await res.json()                                    
  const urlWithCacheBust = `${data.url}?t=${Date.now()}`  // Add cache busting query param
  setUploadStatus(`Image ready! (May take a few seconds to refresh)\n${urlWithCacheBust}`)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border p-6 text-center border-blue-400">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text mb-4 text-blue-400">
            Python Rubik's Cube Solver
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Complete CFOP algorithm implementation with 3D visualization
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* 3D Cube Visualization */}
          <div className="lg:col-span-2">
            <Card className="backdrop-blur-sm border p-6 text-transparent border-blue-400 bg-sidebar-accent">
              <div className="h-96 w-full">
                <Canvas
                  camera={{ position: [5, 5, 5], fov: 50 }}
                  ref={canvasRef}
                  gl={{ preserveDrawingBuffer: true }}
                  onCreated={({ gl, scene, camera }) => {
                    gl.setClearColor("#1c222b", 1)
                    glRef.current = gl
                    sceneRef.current = scene
                    cameraRef.current = camera
                  }}
                >
                    <ambientLight intensity={1.0} />
                  <hemisphereLight
                    args={[0xb1e1ff, 0xffffff]} // light blue sky with white ground , make rubik lighter
                    intensity={1.0}
                  />
                  <RubiksCube cubeState={cubeState} />
                  <OrbitControls enablePan={false} enableZoom={true} />
                </Canvas>
              </div>
              {/* Status Display */}
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {currentPhase && (
                      <Badge variant="secondary" className="bg-primary/20 text-primary">
                        {currentPhase}
                      </Badge>
                    )}
                    {currentStep && <span className="text-primary font-mono text-lg">{currentStep}</span>}
                  </div>
                  {solveTime && (
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                        {solveTime.toFixed(2)}s
                      </Badge>
                      <Badge variant="secondary" className="bg-accent/20 text-accent">
                        {totalSteps} moves
                      </Badge>
                    </div>
                  )}
                </div>

                {uploadStatus && <div className="text-sm text-center text-gray-300">{uploadStatus}</div>}

                {progress > 0 && <Progress value={progress} className="h-2 bg-gray-700" />}
              </div>
            </Card>
          </div>

          {/* Control Panel */}
          <div className="space-y-6">
            {/* Main Controls */}
            <Card className="backdrop-blur-sm border p-6 border-blue-400 bg-sidebar-accent">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-yellow-400" />
                Controls
              </h3>

              <div className="space-y-3">
                <Button
                  onClick={scrambleCube}
                  disabled={isScrambling || isSolving}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                >
                  <Shuffle className="w-4 h-4 mr-2" />
                  {isScrambling ? "Scrambling..." : "Scramble"}
                </Button>

                <Button
                  onClick={solveCube}
                  disabled={isSolving || isScrambling}
                  className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {isSolving ? "Solving..." : "Auto Solve (CFOP)"}
                </Button>

                <Button
                  onClick={captureAndUploadCubeImage}
                  disabled={isScrambling || isSolving}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Capture & Update Image
                </Button>

                {(isSolving || isScrambling) && (
                  <Button
                    onClick={togglePause}
                    variant="outline"
                    className="w-full border-yellow-600 hover:bg-yellow-800 bg-transparent"
                  >
                    {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                    {isPaused ? "Resume" : "Pause"}
                  </Button>
                )}

                <Button
                  onClick={resetCube}
                  // Removed disabled prop to always allow reset
                  variant="outline"
                  className="w-full border-gray-600 hover:bg-gray-800 bg-transparent"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>
            </Card>

            {/* Speed Control */}
            <Card className="backdrop-blur-sm border p-6 border-blue-400 bg-sidebar-accent">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-400" />
                Speed Control
              </h3>
              <div className="flex items-center gap-4">
                <Slider
                  min={1}
                  max={10}
                  step={1}
                  value={[speed]}
                  onValueChange={(val) => setSpeed(val[0])}
                  className="w-full"
                  disabled={isScrambling || isSolving}
                />
                <span className="text-lg font-bold w-20 text-right">{speed} steps/s</span>
              </div>
            </Card>

            {/* CFOP Algorithm Info */}
            <Card className="backdrop-blur-sm border p-6 border-blue-400 bg-sidebar-accent">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-violet-400" />
                CFOP Method
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Cross:</span>
                  <span className="text-accent">White Cross</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">F2L:</span>
                  <span className="text-accent">First Two Layers</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">OLL:</span>
                  <span className="text-accent">Orient Last Layer</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">PLL:</span>
                  <span className="text-accent">Permute Last Layer</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Move History - Full Width Below */}
        {moveHistory.length > 0 && (
          <Card className="backdrop-blur-sm border p-6 mt-8 border-blue-400 bg-sidebar-accent">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Play className="w-5 h-5 text-green-400" />
              Move History ({moveHistory.length} moves)
            </h3>

            <div className="max-h-40 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {moveHistory.map((move, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="bg-green-500/20 text-green-400 text-sm font-mono px-3 py-1"
                  >
                    {move}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Features */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <Card className="bg-black/20 backdrop-blur-sm border p-6 text-center border-blue-400">
            <Brain className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
            <h3 className="text-xl font-semibold mb-2">Complete CFOP</h3>
            <p className="text-gray-400">Full implementation of Cross, F2L, OLL, and PLL algorithms</p>
          </Card>

          <Card className="bg-black/20 backdrop-blur-sm border p-6 text-center border-blue-400">
            <Target className="w-12 h-12 mx-auto mb-4 text-violet-400" />
            <h3 className="text-xl font-semibold mb-2">Python Converted</h3>
            <p className="text-gray-400">Direct conversion from Python with all original algorithms</p>
          </Card>

          <Card className="bg-black/20 backdrop-blur-sm border p-6 text-center border-blue-400">
            <Zap className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Real-time 3D</h3>
            <p className="text-gray-400">Interactive 3D visualization with smooth step-by-step solving</p>
          </Card>
        </div>
      </div>
      <Footer /> {/* Add the Footer component here */}
    </div>
  )
}
