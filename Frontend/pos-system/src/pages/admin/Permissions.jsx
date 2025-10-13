import React, { useState, useEffect } from 'react'

export default function Permissions(){
  const [jsonText, setJsonText] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('role_permissions')
    setJsonText(raw || JSON.stringify({ admin: ["admin","warehouse","sales"] }, null, 2))
  }, [])

  function handleSave(){
    try{
      const parsed = JSON.parse(jsonText)
      localStorage.setItem('role_permissions', JSON.stringify(parsed))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch(e){
      alert('Invalid JSON')
    }
  }

  return (
    <div>
      <h1>Permissions</h1>
      <p>Edit role → UI keys mapping (saved to localStorage for now)</p>
      <textarea value={jsonText} onChange={e => setJsonText(e.target.value)} style={{ width: '100%', height: 240 }} />
      <div style={{ marginTop: 8 }}>
        <button onClick={handleSave} style={{ background: '#059669', color: '#fff', padding: '8px 12px', borderRadius: 6, border: 'none' }}>Save</button>
        {saved && <span style={{ marginLeft: 12, color: '#059669' }}>Saved</span>}
      </div>
    </div>
  )
}
