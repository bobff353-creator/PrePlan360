import type { StickneyBoxCard, StickneyBoxCardAlarmRow } from "@/db/stickney";

const columnCount = 8;

function preservedSourceUrl(value: unknown) {
  const source = String(value || "").trim();
  return source.startsWith("/box-cards/") || /^https?:\/\//i.test(source) ? source : "";
}

function alarm(alarmLevel: string, cells: string[]): StickneyBoxCardAlarmRow {
  return {
    alarm: alarmLevel,
    cells: [...cells.slice(0, columnCount), ...Array(Math.max(0, columnCount - cells.length)).fill("")],
  };
}

type StickneyLayout = {
  sourceUrl: string;
  rows: StickneyBoxCardAlarmRow[];
  interdivisional?: string;
};

const layouts: Record<string, StickneyLayout> = {
  "300-E": {
    sourceUrl: "/box-cards/stickney-1.jpg",
    rows: [
      alarm("Still", ["Stickney\nForest View", "Central Stickney", "", "Stickney", "Stickney\nForest View\nCicero"]),
      alarm("Full Still (working fire)", ["Berwyn\nForest Park", "Cicero", "Lyons", "Brookfield", "", "", "Summit (Engine)\nBedford Park (Ambulance)"]),
      alarm("Box", ["River Forest\nNorth Riverside", "Oak Park", "", "", "Division 11 Chiefs", "Pleasantview Rehab\nAsk if command vehicle is required"]),
      alarm("2nd", ["Bridgeview\nLaGrange Park", "Riverside", "Evergreen Park", "LaGrange"]),
      alarm("3rd", ["Roberts Park\nPleasantview", "Brookfield"]),
      alarm("4th", ["Westchester\nHinsdale", "Tri-State"]),
    ],
    interdivisional: "1st choice: Division 12\n2nd choice: Division 9 (Chicago)",
  },
  "300-W": {
    sourceUrl: "/box-cards/stickney-2.jpg",
    rows: [
      alarm("Still", ["Stickney\nForest View", "McCook", "", "Stickney", "Stickney\nForest View"]),
      alarm("Full Still (working fire)", ["Berwyn\nCicero", "Central Stickney", "Lyons", "Brookfield", "Lyons", "", "Summit (Engine)\nBedford Park (Ambulance)"]),
      alarm("Box", ["River Forest\nForest Park\nNorth Riverside", "Oak Park", "", "", "Division 11 Chiefs", "Pleasantview Rehab\nAsk if command vehicle is required"]),
      alarm("2nd", ["Bridgeview\nLaGrange Park", "Riverside", "Evergreen Park", "LaGrange"]),
      alarm("3rd", ["Roberts Park\nTri-State", "Bedford Park"]),
      alarm("4th", ["Westchester\nHinsdale", "Pleasantview"]),
    ],
    interdivisional: "1st choice: Division 9 (Chicago)\n2nd choice: Division 12",
  },
  "399": {
    sourceUrl: "/box-cards/stickney-3.jpg",
    rows: [
      alarm("Still", ["Stickney\nForest View", "", "", "Stickney", "Stickney"]),
      alarm("Box", ["", "Central Stickney", "", "Cicero\nForest View\nCentral Stickney\nBerwyn\nLyons", "Forest View\nLyons", "", "Summit (Engine)\nBedford Park (Ambulance)"]),
      alarm("2nd", ["", "", "", "North Riverside\nForest Park\nRiverside\nOak Park\nRiver Forest", "Division 11 Chiefs", "Rehab / Command Van (if needed)"]),
      alarm("3rd", ["", "", "", "McCook\nMaywood\nBrookfield\nBroadview\nLaGrange"]),
      alarm("4th", ["", "", "", "Bridgeview\nWestchester\nOak Brook\nPleasantview\nWestern Springs"]),
    ],
    interdivisional: "Interdivisional ambulance task force",
  },
  "1000": {
    sourceUrl: "/box-cards/stickney-4.jpg",
    rows: [
      alarm("Still", ["Stickney\nForest View", "Central Stickney", "", "Stickney", "Stickney\nForest View"]),
      alarm("Full Still", ["", "", "", "", "", "", "Summit (Engine)\nBedford Park (Ambulance)"]),
      alarm("Box", ["Cicero", "", "", "North Riverside", "Division 11", "Two HazMat personnel from each Division 11 town\n1100 Command\nBedford Park HazMat Squad\nOperations or Technician level\nDecon Unit - Division 19"]),
      alarm("2nd", ["", "", "", "Lyons", "", "One additional member from a Division 11 department\nDivision 21 HazMat Team"]),
      alarm("3rd", ["", "", "", "", "", "Ask command if command vehicle is required\nDivision 10 HazMat Team"]),
      alarm("4th", ["", "", "", "", "", "Division 20 HazMat Team"]),
      alarm("5th", ["", "", "", "", "", "Division 12 HazMat Team"]),
    ],
  },
  "303-E": {
    sourceUrl: "/box-cards/stickney-5.jpg",
    rows: [
      alarm("Still", ["Stickney", "", "", "Stickney", "Stickney"]),
      alarm("Box", ["Forest View", "Cicero", "Lyons", "Central Stickney\nCicero", "Forest View\nCicero\nLyons", "", "Summit (Engine)\nBedford Park (Ambulance)"]),
      alarm("2nd", ["", "Berwyn", "", "", "Berwyn", "Additional ambulances: upgrade to Ambulance Box Card 399"]),
      alarm("3rd", []),
      alarm("4th", []),
    ],
  },
  "303-W": {
    sourceUrl: "/box-cards/stickney-6.jpg",
    rows: [
      alarm("Still", ["Stickney", "", "", "Stickney", "Stickney"]),
      alarm("Box", ["Forest View", "Berwyn", "Lyons", "Riverside\nNorth Riverside", "Forest View\nLyons\nBerwyn", "", "Summit (Engine)\nBedford Park (Ambulance)"]),
      alarm("2nd", ["", "Cicero", "", "", "", "Additional ambulances: upgrade to Ambulance Box Card 399"]),
      alarm("3rd", []),
      alarm("4th", []),
    ],
  },
  "305": {
    sourceUrl: "/box-cards/stickney-7.jpg",
    rows: [
      alarm("Still", ["Stickney\nForest View", "Central Stickney", "", "Stickney", "Stickney"]),
      alarm("Full Still", ["Lyons\nCicero", "Berwyn", "", "", "Lyons\nCicero", "", "Summit (Engine)\nBedford Park (Ambulance)"]),
      alarm("Box", ["Riverside", "", "", "Cicero\nBerwyn", "Division 11", "Two TRT personnel from each Division 11 department\n1111 TRT Truck\n1112 TRT Trailer\nRehab Unit"]),
      alarm("2nd", ["McCook", "", "Bedford Park", "River Forest", "", "All additional Division 11 TRT members\nDivision 20 TRT"]),
      alarm("3rd", ["Bridgeview", "Brookfield", "", "", "", "Ask command if command vehicle is required\nDivision 10 TRT"]),
      alarm("4th", ["", "", "", "", "", "Division 21 TRT"]),
    ],
  },
  "301": {
    sourceUrl: "/box-cards/stickney-8.jpg",
    rows: [
      alarm("Still", []),
      alarm("Box", ["", "", "", "", "", "One fire investigator from each Division 11 town\nContact Investigators Coordinator\n1105 upon request\nState Fire Marshal upon request"]),
      alarm("2nd", ["", "", "", "", "", "One additional investigator from each Division 11 town\nAsk command if command vehicle is required"]),
    ],
    interdivisional: "1st choice: Division 10",
  },
  "306": {
    sourceUrl: "/box-cards/stickney-9.jpg",
    rows: [
      alarm("Still", ["Stickney\nForest View", "", "", "Stickney", "Stickney"]),
      alarm("Full Still", ["", "", "", "", "Riverside\nLyons", "Lyons & Riverside boats\nNotify Coast Guard", "Summit (Engine)\nBedford Park (Ambulance)"]),
      alarm("Box", ["Berwyn", "", "", "Cicero", "Division 11", "Division 9 - CFD Dive Team\nDivision 10 Rehab Unit\nAsk command if command vehicle is required"]),
      alarm("2nd", ["", "", "", "North Riverside"]),
      alarm("3rd", []),
      alarm("4th", []),
      alarm("5th", []),
    ],
    interdivisional: "1st choice: Division 12 - Under / Swift Water",
  },
};

export function hydrateStickneyBoxCardLayout(card: StickneyBoxCard): StickneyBoxCard {
  if (card.department?.trim().toLowerCase() !== "stickney") {
    return {
      ...card,
      division: card.division || "",
      alarm_rows: Array.isArray(card.alarm_rows) ? card.alarm_rows : [],
      interdivisional: card.interdivisional || "",
    };
  }

  const layout = layouts[card.box_number?.trim().toUpperCase()];
  const originalSource = preservedSourceUrl(card.document_url);
  return {
    ...card,
    division: card.division || "11",
    alarm_rows: Array.isArray(card.alarm_rows) && card.alarm_rows.length ? card.alarm_rows : layout?.rows || [],
    interdivisional: card.interdivisional || layout?.interdivisional || "",
    document_url: originalSource || layout?.sourceUrl || "",
    document_page: card.document_page || (layout ? 1 : 0),
  };
}
