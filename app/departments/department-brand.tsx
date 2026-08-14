import type { Department } from "@/db/access";

export function DepartmentLogo({ department, className = "" }: { department: Department; className?: string }) {
  return department.logo_key
    ? <img className={`department-logo ${className}`} src={`/api/departments/${department.id}/logo`} alt={`${department.name} logo`}/>
    : <span className={`department-monogram ${className}`} style={{ background: department.brand_primary }}>{department.name.slice(0, 2).toUpperCase()}</span>;
}

export function DepartmentEditor({ department, supportSessionId }: { department: Department; supportSessionId?: string }) {
  const actionSuffix = supportSessionId ? <input type="hidden" name="support_session_id" value={supportSessionId}/> : null;
  return <div className="department-editor-stack">
    <section className="department-editor branding-editor"><div><span>APP BRANDING</span><h2>Department identity</h2><p>The saved name, logo, and five-color palette replace PrePlan 360 branding throughout the department app.</p></div><form method="post" action={`/api/departments/${department.id}`}>
      {actionSuffix}
      <label>Department name<input required name="name" defaultValue={department.name}/></label>
      <label>Visible app name<input required name="app_title" defaultValue={department.app_title || department.name}/></label>
      <label className="wide">Welcome message<input name="welcome_message" defaultValue={department.welcome_message} placeholder="Department operations, connected."/></label>
      <label>Deep red / primary<input type="color" name="brand_primary" defaultValue={department.brand_primary}/></label>
      <label>Black / background<input type="color" name="brand_secondary" defaultValue={department.brand_secondary}/></label>
      <label>Gold / accent<input type="color" name="brand_accent" defaultValue={department.brand_accent}/></label>
      <label>Blue / action<input type="color" name="brand_action" defaultValue={department.brand_action}/></label>
      <label>Orange / alert<input type="color" name="brand_alert" defaultValue={department.brand_alert}/></label>
      <label>Weather coordinates<input name="weather_location" defaultValue={department.weather_location} placeholder="41.7500, -87.6400"/><small>Verified latitude, longitude coordinates connect National Weather Service forecasts and active alerts.</small></label>
      <label>Stations<input required min="0" max="99" type="number" name="station_count" defaultValue={department.station_count}/></label>
      <label>Vehicles<input required min="0" max="999" type="number" name="vehicle_count" defaultValue={department.vehicle_count}/></label>
      <button className="access-primary" type="submit">Save branding and profile</button>
    </form></section>
    <section className="logo-uploader"><div className="logo-preview" style={{ background: department.brand_secondary }}><DepartmentLogo department={department}/></div><div><span>DEPARTMENT LOGO</span><h2>Upload the official mark</h2><p>PNG, JPG, WebP, or GIF. Maximum 3 MB. It appears in the app header, sign-in card, and mobile shortcut experience.</p><form method="post" action={`/api/departments/${department.id}/logo`} encType="multipart/form-data">{supportSessionId ? <input type="hidden" name="support_session_id" value={supportSessionId}/> : null}<input required type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/gif"/><button className="access-secondary" type="submit">Upload logo</button></form></div></section>
  </div>;
}
