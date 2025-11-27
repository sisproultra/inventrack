
import React, { useState, useEffect, useRef } from 'react';
import { InventoryItem, Rack, RackLocation, Zone, ZoneType } from '../types';
import { formatDate } from '../utils';
import { Info, Package, Lock, Snowflake, Sun, Scan, CheckCircle, User, Clock, XCircle, ArrowRightFromLine, FileSpreadsheet, LayoutGrid } from './Icons';

interface LayoutProps {
  inventory: InventoryItem[];
  racks: Rack[];
  zones: Zone[];
  onAssignLocation: (lpn: string, location: RackLocation) => void;
  onDispatch: (lpn: string) => void;
  itemsPendingLocation: InventoryItem[];
}

const Layout: React.FC<LayoutProps> = ({ 
  inventory, 
  racks, 
  zones,
  onAssignLocation,
  onDispatch,
  itemsPendingLocation 
}) => {
  const [activeZoneId, setActiveZoneId] = useState<string>('');
  
  // Modal States
  const [selectedSlotItem, setSelectedSlotItem] = useState<InventoryItem | null>(null);
  const [isScanMode, setIsScanMode] = useState(false);

  // Scan Mode States
  const [scanLPN, setScanLPN] = useState('');
  const [scanLocation, setScanLocation] = useState('');
  const [scanStep, setScanStep] = useState<'LPN' | 'LOCATION' | 'CONFIRM'>('LPN');
  const [scanMessage, setScanMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);
  const lpnInputRef = useRef<HTMLInputElement>(null);
  const locInputRef = useRef<HTMLInputElement>(null);

  // Set initial active zone when zones load
  useEffect(() => {
    if (zones.length > 0 && !activeZoneId) {
      setActiveZoneId(zones[0].id);
    }
  }, [zones]);

  // Focus management for Scan Mode
  useEffect(() => {
    if (isScanMode) {
        if (scanStep === 'LPN') lpnInputRef.current?.focus();
        if (scanStep === 'LOCATION') locInputRef.current?.focus();
    }
  }, [isScanMode, scanStep]);

  const activeZone = zones.find(z => z.id === activeZoneId);

  const getZoneCode = (type?: ZoneType) => {
    switch(type) {
        case 'DRY': return 'SE';
        case 'COLD': return 'RF';
        case 'FROZEN': return 'CG';
        default: return 'GN';
    }
  };

  // Helper to check if a specific slot is occupied or blocked
  const getSlotStatus = (rack: Rack, level: number, position: number) => {
    const rackId = rack.id;
    
    // Check occupancy
    const item = inventory.find(i => 
      i.location?.rackId === rackId && 
      i.location?.level === level && 
      i.location?.position === position
    );

    // Check blocked status from rack config
    const slotConfig = rack.slots.find(s => s.location.level === level && s.location.position === position);
    const isBlocked = slotConfig?.isBlocked || false;

    if (isBlocked) return { status: 'blocked' as const, item: null };
    if (item) return { status: 'occupied' as const, item };
    return { status: 'empty' as const, item: null };
  };

  const handleExportStock = () => {
      const rackedItems = inventory.filter(i => i.location !== null);
      if(rackedItems.length === 0) {
          alert('No hay stock en racks para exportar.');
          return;
      }

      // Headers
      const headers = ['LPN', 'Tipo', 'Producto', 'SKU', 'Cantidad', 'Vencimiento', 'Fecha Recepcion', 'Pasillo', 'Rack', 'Nivel', 'Posicion'];
      
      const csvRows = [headers.join(',')];
      
      for(const item of rackedItems) {
          const row = [
              item.lpn,
              item.isMixed ? 'Mixto' : 'Unico',
              `"${item.productName.replace(/"/g, '""')}"`, // Escape quotes
              item.productCode,
              item.quantity,
              item.expirationDate,
              item.receptionDate.split('T')[0],
              item.location?.aisle || '',
              item.location?.rackId || '',
              item.location?.level || '',
              item.location?.position || ''
          ];
          csvRows.push(row.join(','));
      }

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
      const link = document.createElement("a");
      link.setAttribute("href", csvContent);
      link.setAttribute("download", `stock_smartrack_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleSlotClick = (rack: Rack, level: number, position: number) => {
    const { status, item } = getSlotStatus(rack, level, position);

    if (status === 'blocked') return;

    if (status === 'occupied' && item) {
       setSelectedSlotItem(item); // Open Detail Modal
    } 
    else if (status === 'empty') {
        // Auto-Trigger Scan Mode for Assignment
        setIsScanMode(true);
        // Pre-fill location: ZoneCode-Aisle-Pos-Level (e.g., SE-A-1-5)
        const zoneCode = getZoneCode(activeZone?.type);
        const locationCode = `${zoneCode}-${rack.aisle}-${position}-${level}`;
        setScanLocation(locationCode);
        
        // If we have a location, we just need the LPN. 
        setScanStep('LPN'); 
        setScanMessage({ type: 'info', text: `Ubicación ${locationCode} seleccionada. Por favor escanee el LPN.` });
    }
  };

  // --- SCAN MODE LOGIC ---
  const handleScanLPNSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      // Validate LPN exists in Pending
      const cleanLPN = scanLPN.trim();
      
      const pendingItem = itemsPendingLocation.find(i => i.lpn === cleanLPN);
      
      if (pendingItem) {
          setScanMessage(null);
          if (scanLocation) {
             finalizeAssignment(cleanLPN, scanLocation);
          } else {
             setScanStep('LOCATION');
          }
      } else {
          // Check if already assigned
          const exists = inventory.find(i => i.lpn === cleanLPN);
          if (exists) {
              setScanMessage({ type: 'error', text: `El LPN ${cleanLPN} ya está ubicado en ${exists.location?.aisle}${exists.location?.rackId}-${exists.location?.level}-${exists.location?.position}` });
          } else {
              setScanMessage({ type: 'error', text: `LPN ${cleanLPN} no encontrado en recepción pendiente.` });
          }
          setScanLPN('');
          lpnInputRef.current?.focus();
      }
  };

  const handleScanLocationSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      finalizeAssignment(scanLPN, scanLocation);
  };

  const finalizeAssignment = (lpn: string, locString: string) => {
      // Format: ZONE-AISLE-POS-LEVEL (e.g., SE-A-1-5)
      const regex = /^([A-Z]{2})-([A-Z0-9]+)-(\d+)-(\d+)$/;
      const match = locString.trim().toUpperCase().match(regex);

      if (match) {
          const [_, zoneCode, aisle, posStr, levelStr] = match;
          const position = parseInt(posStr);
          const level = parseInt(levelStr);

          // Find Zone Type from code to validate
          let zoneType: ZoneType | undefined;
          if (zoneCode === 'SE') zoneType = 'DRY';
          else if (zoneCode === 'RF') zoneType = 'COLD';
          else if (zoneCode === 'CG') zoneType = 'FROZEN';

          // Validate Zone
          const targetZone = zones.find(z => z.type === zoneType);
          if (!targetZone) {
               setScanMessage({ type: 'error', text: `Código de zona '${zoneCode}' no reconocido.` });
               setScanLocation('');
               return;
          }

          const rack = racks.find(r => r.zoneId === targetZone.id && r.aisle === aisle);
          
          if (rack) {
              const { status } = getSlotStatus(rack, level, position);
              if (status === 'empty') {
                  // SUCCESS
                  onAssignLocation(lpn, { aisle, rackId: rack.id, level, position });
                  setScanMessage({ type: 'success', text: `Asignado correctamente: ${lpn} -> ${locString}` });
                  
                  // Reset for next scan immediately
                  setScanLPN('');
                  setScanLocation('');
                  setScanStep('LPN');
                  setTimeout(() => setScanMessage(null), 3000); 
              } else {
                  setScanMessage({ type: 'error', text: `Ubicación ${locString} no está disponible (${status}).` });
                  setScanLocation('');
                  if(scanStep === 'LOCATION') locInputRef.current?.focus();
              }
          } else {
              setScanMessage({ type: 'error', text: `No se encontró rack en Pasillo ${aisle} / Zona ${zoneCode}.` });
              setScanLocation('');
          }
      } else {
          setScanMessage({ type: 'error', text: "Formato inválido. Use: ZONA-PASILLO-COL-NIV (ej. SE-A-1-5)" });
          setScanLocation('');
      }
  }

  const visibleRacks = racks.filter(r => r.zoneId === activeZoneId);
  const aisles = Array.from(new Set(visibleRacks.map(r => r.aisle))).sort();

  // Helper for alert colors
  const getSlotColor = (status: string, item: InventoryItem | null) => {
      if (status === 'blocked') return 'bg-gray-300 border-gray-400 cursor-not-allowed';
      if (status === 'empty') return 'bg-red-50 border-red-200 hover:bg-red-100';
      
      if (status === 'occupied' && item) {
          // Expiration Check
          const today = new Date();
          const expDate = new Date(item.expirationDate);
          const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          // Critical Alert: <= 5 days (includes expired)
          if (diffDays <= 5) {
              if (item.isMixed) return 'bg-blue-600 border-blue-700 animate-pulse ring-4 ring-red-500'; // Mixed but critical
              return 'bg-red-600 border-red-700 animate-pulse'; 
          }
          
          // Warning: <= 30 days
          if (diffDays <= 30) {
              if (item.isMixed) return 'bg-blue-600 border-blue-700'; // Mixed Warning (keep blue but maybe light border?)
              return 'bg-amber-300 border-amber-400'; 
          }

          // Mixed Pallet (Safe)
          if (item.isMixed) return 'bg-blue-600 border-blue-700 hover:bg-blue-500';

          // Standard OK
          return 'bg-emerald-200 border-emerald-300'; 
      }
      return 'bg-gray-100';
  }

  return (
    <div className="flex flex-col h-full gap-4 relative">
      
      {/* Top Bar: Zone Selector & Actions */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-3 rounded-xl shadow-sm border border-gray-200">
         <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {zones.map(zone => (
                <button
                    key={zone.id}
                    onClick={() => setActiveZoneId(zone.id)}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg border transition-all min-w-max
                        ${activeZoneId === zone.id 
                            ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-sm ring-1 ring-blue-200' 
                            : 'bg-white border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700'}
                    `}
                >
                    {zone.type === 'DRY' ? <Sun className="w-5 h-5"/> : <Snowflake className="w-5 h-5"/>}
                    <div className="text-left">
                        <div className="font-bold text-sm leading-tight">{zone.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">CODE: {getZoneCode(zone.type)}</div>
                    </div>
                </button>
            ))}
         </div>

         <div className="flex items-center gap-4 ml-auto">
             <div className="flex items-center gap-2 text-[10px] md:text-xs text-gray-500 hidden md:flex flex-wrap">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-200 rounded border border-emerald-300"></div> OK</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-600 rounded border border-blue-700"></div> Mixto</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-300 rounded border border-amber-400"></div> &lt;30 Días</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-600 rounded border border-red-700 animate-pulse"></div> ≤5 Días</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-50 rounded border border-red-200"></div> Vacío</div>
             </div>

             <button 
                onClick={handleExportStock}
                className="hidden md:flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-all font-bold text-sm"
             >
                 <FileSpreadsheet className="w-4 h-4" />
                 Excel
             </button>
             
             <button 
                onClick={() => {
                    setIsScanMode(true);
                    setScanLPN('');
                    setScanLocation('');
                    setScanStep('LPN');
                    setScanMessage(null);
                }}
                className="flex items-center gap-2 bg-slate-800 text-white px-5 py-2 rounded-lg shadow-lg hover:bg-slate-700 hover:scale-105 transition-all font-bold animate-pulse text-sm"
             >
                 <Scan className="w-4 h-4" />
                 Modo Escáner
             </button>
         </div>
      </div>

      {/* Racks Visualization (Full Width) */}
      <div className="flex-1 overflow-auto bg-slate-100 rounded-xl border border-slate-200 p-4 shadow-inner">
        {visibleRacks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Package className="w-16 h-16 mb-4 opacity-20"/>
                <p className="text-lg font-medium">No hay racks configurados en esta cámara.</p>
            </div>
        ) : (
            aisles.map(aisle => (
                <div key={aisle} className="flex flex-col gap-3 min-w-max mb-10">
                    <h3 className="text-xl font-bold text-slate-500 border-b-2 border-slate-200 pb-1 ml-2 flex items-center gap-2 sticky left-0 w-full">
                        <span className="bg-slate-200 px-2 rounded text-slate-700">Pasillo {aisle}</span>
                    </h3>
                    
                    <div className="flex flex-wrap gap-8 p-2">
                        {visibleRacks.filter(r => r.aisle === aisle).map(rack => {
                            const levels = Array.from({ length: rack.levels }, (_, i) => rack.levels - i); 
                            const positions = Array.from({ length: rack.positionsPerLevel }, (_, i) => i + 1);

                            return (
                                <div key={rack.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-3 w-max">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="font-bold text-xs text-slate-500 uppercase tracking-wider">Rack {rack.id}</div>
                                    </div>
                                    
                                    <div className="inline-block">
                                        <div className="bg-blue-900 p-1.5 rounded-sm relative shadow-inner">
                                            {/* Rack Structure */}
                                            <div 
                                                className="grid gap-[2px] bg-blue-900" 
                                                style={{ gridTemplateColumns: `repeat(${rack.positionsPerLevel}, 1fr)` }}
                                            >
                                                {levels.map(level => (
                                                    positions.map(pos => {
                                                        const { status, item } = getSlotStatus(rack, level, pos);
                                                        const colorClass = getSlotColor(status, item);
                                                        // Check if background is strong red or blue to flip icon color
                                                        const isDarkBg = colorClass.includes('bg-red-600') || colorClass.includes('bg-blue-600');
                                                        const zoneCode = getZoneCode(activeZone?.type);
                                                        const locationTooltip = `${zoneCode}-${rack.aisle}-${pos}-${level}`;

                                                        return (
                                                            <div 
                                                                key={`${level}-${pos}`}
                                                                onClick={() => handleSlotClick(rack, level, pos)}
                                                                className={`
                                                                    w-8 h-8 relative cursor-pointer group transition-all flex items-center justify-center border rounded-sm
                                                                    ${colorClass}
                                                                `}
                                                            >
                                                                {/* Custom CSS Tooltip */}
                                                                <div className="absolute bottom-[110%] left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap shadow-sm">
                                                                    {locationTooltip}
                                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                                                </div>

                                                                {status === 'occupied' && item && (
                                                                    <Package className={`w-5 h-5 ${isDarkBg ? 'text-white' : 'text-slate-800/60'}`} />
                                                                )}
                                                                {status === 'blocked' && (
                                                                    <Lock className="w-3 h-3 text-gray-500 opacity-50" />
                                                                )}
                                                                {status === 'empty' && (
                                                                    <div className="text-[6px] text-red-300 font-mono select-none">{pos}</div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                ))}
                                            </div>
                                            
                                            {/* Floor Labels */}
                                            <div 
                                                className="grid mt-1 pt-1 border-t border-blue-400/30" 
                                                style={{ gridTemplateColumns: `repeat(${rack.positionsPerLevel}, 1fr)` }}
                                            >
                                                {positions.map(p => (
                                                    <div key={p} className="text-center text-[7px] font-bold text-blue-200/60">
                                                        {p}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))
        )}
      </div>

      {/* --- MODAL: ITEM DETAIL --- */}
      {selectedSlotItem && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
                  <div className={`p-6 relative text-white ${selectedSlotItem.isMixed ? 'bg-blue-700' : 'bg-slate-800'}`}>
                      <button 
                        onClick={() => setSelectedSlotItem(null)}
                        className="absolute top-4 right-4 text-white/70 hover:text-white"
                      >
                          <XCircle className="w-6 h-6" />
                      </button>
                      <h3 className="text-lg font-medium text-white/80 mb-1">Detalle de Ubicación</h3>
                      <h2 className="text-2xl font-bold">{selectedSlotItem.productName}</h2>
                      {selectedSlotItem.isMixed && (
                          <div className="inline-block bg-blue-500/50 px-2 py-0.5 rounded text-xs mt-1 font-bold border border-blue-400">PALLET MIXTO</div>
                      )}
                  </div>
                  
                  <div className="p-6 space-y-6">
                      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <div>
                              <p className="text-xs text-gray-500 font-bold uppercase">LPN ID</p>
                              <p className="text-2xl font-mono font-black text-slate-800">{selectedSlotItem.lpn}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-xs text-gray-500 font-bold uppercase">Total</p>
                              <p className="text-2xl font-bold text-blue-600">{selectedSlotItem.quantity}</p>
                          </div>
                      </div>

                      <div className="space-y-3">
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                              <User className="w-5 h-5 text-gray-400" />
                              <span className="font-semibold">Recibido por:</span>
                              <span>{selectedSlotItem.receivedBy || 'Desconocido'}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                              <Clock className="w-5 h-5 text-gray-400" />
                              <span className="font-semibold">Fecha Recepción:</span>
                              <span>{new Date(selectedSlotItem.receptionDate).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                              <Clock className="w-5 h-5 text-red-400" />
                              <span className="font-semibold">Vencimiento (Crítico):</span>
                              <span className="text-red-600 font-medium">{formatDate(selectedSlotItem.expirationDate)}</span>
                          </div>
                      </div>

                      {/* Mixed Items Detail Table */}
                      {selectedSlotItem.isMixed && selectedSlotItem.mixedItems && (
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-gray-100 px-3 py-2 text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                  <LayoutGrid className="w-3 h-3"/> Contenido del Pallet
                              </div>
                              <div className="max-h-40 overflow-y-auto">
                                  <table className="w-full text-xs text-left">
                                      <thead className="bg-gray-50 border-b">
                                          <tr>
                                              <th className="px-3 py-2">Producto</th>
                                              <th className="px-3 py-2 text-center">Cant</th>
                                              <th className="px-3 py-2 text-center">Vence</th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {selectedSlotItem.mixedItems.map((item, i) => (
                                              <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                                                  <td className="px-3 py-2 truncate max-w-[120px]">{item.productName}</td>
                                                  <td className="px-3 py-2 text-center font-bold">{item.quantity}</td>
                                                  <td className="px-3 py-2 text-center text-gray-500">{item.expirationDate}</td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      )}

                      <button
                        onClick={() => {
                            if(window.confirm('¿Confirmar salida de mercadería?')) {
                                onDispatch(selectedSlotItem.lpn);
                                setSelectedSlotItem(null);
                            }
                        }}
                        className="w-full py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold hover:bg-red-100 transition-colors flex justify-center items-center gap-2"
                      >
                          <ArrowRightFromLine className="w-5 h-5" />
                          Registrar Salida
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL: SCAN MODE --- */}
      {isScanMode && (
          <div className="fixed inset-0 z-50 bg-slate-900/90 flex justify-center items-start pt-10 px-4">
              <div className="w-full max-w-4xl flex flex-col md:flex-row gap-6">
                  
                  {/* Scanner Box */}
                  <div className="flex-1">
                      <div className="flex justify-between items-center mb-6 text-white">
                          <h2 className="text-3xl font-black flex items-center gap-3">
                              <Scan className="w-8 h-8 text-green-400" />
                              MODO ESCÁNER
                          </h2>
                          <button 
                            onClick={() => setIsScanMode(false)}
                            className="text-white/50 hover:text-white"
                          >
                              <XCircle className="w-8 h-8" />
                          </button>
                      </div>

                      <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
                          
                          {/* Step 1: Scan LPN */}
                          <div className={`transition-all duration-300 ${scanStep === 'LPN' ? 'opacity-100 translate-x-0' : 'opacity-30 translate-x-[-20px] hidden'}`}>
                              <label className="block text-slate-400 text-sm font-bold uppercase mb-2">Paso 1: Escanear LPN</label>
                              <form onSubmit={handleScanLPNSubmit}>
                                  <input 
                                      ref={lpnInputRef}
                                      type="text" 
                                      value={scanLPN}
                                      onChange={e => setScanLPN(e.target.value)}
                                      placeholder="Escanee código de barra LPN..."
                                      className="w-full bg-slate-900 text-white text-xl font-mono p-4 rounded-lg border-2 border-slate-600 focus:border-green-500 outline-none"
                                      autoFocus
                                  />
                              </form>
                          </div>

                          {/* Step 2: Scan Location */}
                          {scanStep === 'LOCATION' && (
                              <div className="animate-fade-in">
                                  <div className="mb-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                                      <p className="text-xs text-slate-400 uppercase">LPN Seleccionado</p>
                                      <p className="text-2xl font-mono text-white font-bold tracking-widest">{scanLPN}</p>
                                  </div>

                                  <label className="block text-slate-400 text-sm font-bold uppercase mb-2">Paso 2: Escanear Ubicación (QR Rack)</label>
                                  <form onSubmit={handleScanLocationSubmit}>
                                      <input 
                                          ref={locInputRef}
                                          type="text" 
                                          value={scanLocation}
                                          onChange={e => setScanLocation(e.target.value)}
                                          placeholder="Ej. SE-A-1-5 (Zona-Pasillo-Col-Nivel)..."
                                          className="w-full bg-slate-900 text-white text-xl font-mono p-4 rounded-lg border-2 border-slate-600 focus:border-blue-500 outline-none"
                                          autoFocus
                                      />
                                  </form>
                                  <button onClick={() => setScanStep('LPN')} className="mt-4 text-slate-400 text-sm underline">Cancelar y volver a escanear LPN</button>
                              </div>
                          )}

                          {/* Feedback Messages */}
                          {scanMessage && (
                              <div className={`mt-6 p-4 rounded-lg flex items-center gap-3 ${
                                  scanMessage.type === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500/50' :
                                  scanMessage.type === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/50' :
                                  'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              }`}>
                                  {scanMessage.type === 'success' ? <CheckCircle className="w-6 h-6"/> : <Info className="w-6 h-6"/>}
                                  <span className="font-bold">{scanMessage.text}</span>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Helpers: Pending Items List */}
                  {scanStep === 'LPN' && (
                      <div className="w-full md:w-80 bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col h-[500px]">
                          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                             <Package className="w-4 h-4 text-orange-400"/>
                             Pendientes ({itemsPendingLocation.length})
                          </h3>
                          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                              {itemsPendingLocation.length === 0 ? (
                                  <p className="text-slate-500 text-sm italic">No hay ítems pendientes.</p>
                              ) : (
                                  itemsPendingLocation.map(item => (
                                      <button 
                                        key={item.lpn}
                                        onClick={() => {
                                            setScanLPN(item.lpn);
                                            lpnInputRef.current?.focus();
                                        }}
                                        className="w-full text-left bg-slate-700/50 hover:bg-slate-700 p-3 rounded border border-slate-600 hover:border-blue-500 transition-all group"
                                      >
                                          <div className="flex justify-between items-start">
                                              <span className="text-orange-300 font-mono font-bold text-sm">{item.lpn}</span>
                                              <span className="text-slate-400 text-xs">x{item.quantity}</span>
                                          </div>
                                          <div className="text-slate-300 text-xs truncate mt-1">{item.productName}</div>
                                          {item.isMixed && <div className="text-[10px] text-blue-400 uppercase font-bold mt-1">Mixto</div>}
                                      </button>
                                  ))
                              )}
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-700 text-[10px] text-slate-500 text-center">
                              Click en un ítem para autocompletar
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default Layout;
