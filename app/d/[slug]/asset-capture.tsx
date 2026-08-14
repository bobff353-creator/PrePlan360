"use client";

import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";

type VinResult = { make: string; manufacturer: string; model: string; modelYear: string; vehicleType: string; bodyClass: string; fuelType: string; engineModel: string; gvwr: string; plant: string; errorText: string; source: string; sourceUrl: string; error?: string };

export default function AssetCapture({ departmentId, supportSessionId = "" }: { departmentId: string; supportSessionId?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [assetType, setAssetType] = useState("vehicle");
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("Camera is off");
  const [vin, setVin] = useState("");
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [modelYear, setModelYear] = useState("");
  const [category, setCategory] = useState("");
  const [vinData, setVinData] = useState<VinResult | null>(null);
  const [lookupStatus, setLookupStatus] = useState("");

  useEffect(() => () => controlsRef.current?.stop(), []);

  function stopCamera(message = "Camera is off") {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
    setScanStatus(message);
  }

  async function startCamera(mode: "vin" | "barcode") {
    setScanStatus("Requesting rear camera…");
    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: "environment" } } }, videoRef.current || undefined, (result, _error, scannerControls) => {
        if (!result) return;
        const value = result.getText().trim();
        if (mode === "vin") setVin(value.toUpperCase().replace(/[^A-Z0-9*]/g, ""));
        else setBarcode(value);
        scannerControls.stop();
        controlsRef.current = null;
        setScanning(false);
        setScanStatus(`${mode === "vin" ? "VIN" : "Barcode"} captured: ${value}`);
      });
      controlsRef.current = controls;
      setScanning(true);
      setScanStatus(`Point the camera at the ${mode === "vin" ? "VIN barcode or printed VIN" : "equipment barcode or QR code"}.`);
    } catch {
      stopCamera("Camera access was unavailable. Enter the VIN or barcode manually.");
    }
  }

  async function decodeVin() {
    setLookupStatus("Checking NHTSA vPIC…");
    setVinData(null);
    try {
      const response = await fetch(`/api/departments/${departmentId}/vin?vin=${encodeURIComponent(vin)}`);
      const data = await response.json() as VinResult;
      if (!response.ok) throw new Error(data.error || "VIN lookup failed");
      setVinData(data);
      setManufacturer(data.manufacturer || data.make || "");
      setModel(data.model || "");
      setModelYear(data.modelYear || "");
      setCategory(data.vehicleType || data.bodyClass || "Vehicle");
      if (!name) setName([data.modelYear, data.make, data.model].filter(Boolean).join(" "));
      setLookupStatus(data.errorText && !/^0/i.test(data.errorText) ? `Decoded with note: ${data.errorText}` : "VIN decoded from NHTSA manufacturer data. Review before saving.");
    } catch (error) {
      setLookupStatus(error instanceof Error ? error.message : "VIN lookup failed. Enter the details manually.");
    }
  }

  return <section className="asset-capture-card"><div className="asset-capture-head"><div><span>ADD APPARATUS OR EQUIPMENT</span><h2>Scan it, verify it, save it.</h2><p>Use a phone or iPad camera for VIN, barcode, or QR capture. VIN results are suggestions from NHTSA and never save until you review the form.</p></div><div className="asset-type-switch"><button type="button" className={assetType === "vehicle" ? "active" : ""} onClick={() => setAssetType("vehicle")}>Vehicle / apparatus</button><button type="button" className={assetType === "equipment" ? "active" : ""} onClick={() => setAssetType("equipment")}>Equipment</button></div></div>
    <div className={`asset-camera ${scanning ? "on" : ""}`}><video ref={videoRef} muted playsInline/><div><b>{scanStatus}</b><span>Camera processing stays on this device. Only the captured code is placed in the form.</span><div>{scanning ? <button type="button" onClick={() => stopCamera()}>Stop camera</button> : <><button type="button" onClick={() => startCamera("vin")}>Scan VIN</button><button type="button" onClick={() => startCamera("barcode")}>Scan barcode / QR</button></>}</div></div></div>
    <form className="asset-create-form" method="post" action={`/api/departments/${departmentId}/assets`}>
      <input type="hidden" name="asset_type" value={assetType}/><input type="hidden" name="support_session_id" value={supportSessionId}/><input type="hidden" name="vin_source" value={vinData?.source || ""}/>
      <label>VIN<div className="field-action"><input name="vin" value={vin} onChange={(event) => setVin(event.target.value.toUpperCase())} placeholder="17-character VIN"/><button type="button" onClick={decodeVin} disabled={!vin}>Decode VIN</button></div><small>{lookupStatus}</small></label>
      <label>Barcode / QR<input name="barcode" value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Scan or enter asset code"/></label>
      <label>Display name<input required name="name" value={name} onChange={(event) => setName(event.target.value)} placeholder={assetType === "vehicle" ? "Engine 1204" : "Thermal camera 1"}/></label>
      <label>Unit / asset number<input name="unit_number" placeholder="E-1204 or EQ-0042"/></label>
      <label>Manufacturer<input name="manufacturer" value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} placeholder="Manufacturer"/></label>
      <label>Model<input name="model" value={model} onChange={(event) => setModel(event.target.value)} placeholder="Model"/></label>
      <label>Model year<input type="number" min="1900" max="2100" name="model_year" value={modelYear} onChange={(event) => setModelYear(event.target.value)}/></label>
      <label>Category<input name="category" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Pumper, SCBA, saw, hose…"/></label>
      <label>Serial number<input name="serial_number" placeholder="Manufacturer serial"/></label>
      <label>Station / compartment<input name="location" placeholder="Station 1 · E-1204 · L1"/></label>
      <label>Odometer<input type="number" inputMode="numeric" min="0" name="odometer" placeholder="Dedicated mileage reading"/></label>
      <label>Engine / operating hours<input type="number" inputMode="numeric" min="0" name="engine_hours" placeholder="Hours"/></label>
      <label>Official manual URL<input type="url" name="manual_url" placeholder="https://manufacturer…"/></label>
      <label>Parts catalog URL<input type="url" name="parts_url" placeholder="https://manufacturer…"/></label>
      <label className="wide">Maintenance notes<textarea name="maintenance_notes" rows={3} placeholder="Known service interval, warranty, vendor, special tools, or repair notes"/></label>
      {vinData ? <div className="vin-review wide"><b>Review NHTSA result before saving</b><span>{[vinData.vehicleType, vinData.bodyClass, vinData.fuelType, vinData.engineModel, vinData.gvwr].filter(Boolean).join(" · ") || "Basic VIN identity returned"}</span><a href={vinData.sourceUrl} target="_blank" rel="noreferrer">Open source record ↗</a></div> : null}
      <button className="asset-save wide" type="submit">Save {assetType === "vehicle" ? "apparatus / vehicle" : "equipment"}</button>
    </form>
  </section>;
}
