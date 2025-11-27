import React, { useState } from 'react';
import { Rack, Zone, ZoneType } from '../types';
import { Trash, Plus, Lock, LockOpen, Snowflake, Sun, Package } from './Icons';

interface ConfigurationProps {
  zones: Zone[];
  racks: Rack[];
  onAddZone: (zone: Zone) => void;
  onDeleteZone: (zoneId: string) => void;
  onAddRack: (rack: Rack) => void;
  onDeleteRack: (rackId: number) => void;
  onToggleBlockSlot: (rackId: number, level: number, position: number) => void;
}

const Configuration: React.FC<ConfigurationProps> = ({
  zones,
  racks,
  onAddZone,
  onDeleteZone,
  onAddRack,
  onDeleteRack,
  onToggleBlockSlot
}) => {
  const [activeTab, setActiveTab] = useState<'ZONES' | 'RACKS' | 'BLOCKING'>('ZONES');
  const [selectedZoneId, setSelectedZoneId] = useState<string>(zones[0]?.id || '');

  // Form States
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneType, setNewZoneType] = useState<ZoneType>('DRY');

  const [newRackAisle, setNewRackAisle] = useState('');
  const [newRackLevels, setNewRackLevels] = useState(6);
  const [newRackPositions, setNewRackPositions] = useState(9);

  // Helper to get blocked status (using racks prop)
  const isSlotBlocked = (rackId: number, level: number, pos: number) => {
    const rack = racks.find(r => r.id === rackId);
    if (!rack) return false;
    const slotId = `${rack.aisle}${rack.id}-${level}-${pos}`; // Simple ID check or property check
    // Since we are not persisting "Slot" objects fully in the App state array (for simplicity), 
    // we need to rely on the `slots` array inside the `rack` object. 
    // In App.tsx, slots are initialized.
    const slot = rack.slots.find(s => s.location.level === level && s.location.position === pos);
    return slot?.isBlocked || false;
  };

  const handleAddZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName) return;
    const newZone: Zone = {
      id: `zone-${Date.now()}`,
      name: newZoneName,
      type: newZoneType
    };
    onAddZone(newZone);
    setNewZoneName('');
  };

  const handleAddRack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRackAisle || !selectedZoneId) return;
    
    // Generate slots
    const newRackId = Math.max(...racks.map(r => r.id), 0) + 1;
    const slots = [];
    for (let l = 1; l <= newRackLevels; l++) {
        for (let p = 1; p <= newRackPositions; p++) {
            slots.push({
                id: `${newRackAisle}${newRackId}-${l}-${p}`,
                location: { aisle: newRackAisle, rackId: newRackId, level: l, position: p },
                status: 'empty' as const,
                isBlocked: false
            });
        }
    }

    const newRack: Rack = {
      id: newRackId,
      zoneId: selectedZoneId,
      aisle: newRackAisle.toUpperCase(),
      levels: newRackLevels,
      positionsPerLevel: newRackPositions,
      slots: slots
    };
    onAddRack(newRack);
    setNewRackAisle('');
  };

  const filteredRacks = racks.filter(r => r.zoneId === selectedZoneId);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-slate-50 border-b border-gray-200 p-4 flex gap-4 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('ZONES')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'ZONES' ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
        >
          1. Cámaras (Zonas)
        </button>
        <button 
          onClick={() => setActiveTab('RACKS')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'RACKS' ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
        >
          2. Crear Racks
        </button>
        <button 
          onClick={() => setActiveTab('BLOCKING')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'BLOCKING' ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
        >
          3. Bloquear Ubicaciones
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        
        {/* ZONES TAB */}
        {activeTab === 'ZONES' && (
          <div className="space-y-8 max-w-4xl mx-auto">
             <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2"><Plus className="w-5 h-5"/> Crear Nueva Cámara</h3>
                <form onSubmit={handleAddZone} className="flex gap-4 items-end flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-blue-800 mb-1">Nombre de Cámara</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-blue-200 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                            placeholder="Ej. Cámara de Fríos"
                            value={newZoneName}
                            onChange={e => setNewZoneName(e.target.value)}
                        />
                    </div>
                    <div className="w-40">
                         <label className="block text-sm font-medium text-blue-800 mb-1">Tipo</label>
                         <select 
                            className="w-full p-2 border border-blue-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            value={newZoneType}
                            onChange={(e) => setNewZoneType(e.target.value as ZoneType)}
                         >
                             <option value="DRY">Seco</option>
                             <option value="COLD">Refrigerado</option>
                             <option value="FROZEN">Congelado</option>
                         </select>
                    </div>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-bold shadow transition-colors">
                        Agregar
                    </button>
                </form>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {zones.map(zone => (
                    <div key={zone.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-full ${zone.type === 'DRY' ? 'bg-orange-100 text-orange-600' : 'bg-cyan-100 text-cyan-600'}`}>
                                {zone.type === 'DRY' ? <Sun className="w-6 h-6"/> : <Snowflake className="w-6 h-6"/>}
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800">{zone.name}</h4>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{zone.type}</span>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                if(window.confirm('¿Borrar esta cámara y todos sus racks?')) onDeleteZone(zone.id);
                            }}
                            className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded"
                        >
                            <Trash className="w-5 h-5"/>
                        </button>
                    </div>
                ))}
             </div>
          </div>
        )}

        {/* RACKS TAB */}
        {activeTab === 'RACKS' && (
             <div className="space-y-6 max-w-5xl mx-auto">
                 <div className="flex items-center gap-4 mb-6">
                    <label className="font-bold text-gray-700">Seleccionar Cámara:</label>
                    <select 
                        className="p-2 border rounded-lg shadow-sm"
                        value={selectedZoneId}
                        onChange={(e) => setSelectedZoneId(e.target.value)}
                    >
                        {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                 </div>

                 <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Agregar Rack a {zones.find(z => z.id === selectedZoneId)?.name}</h3>
                    <form onSubmit={handleAddRack} className="flex gap-4 items-end flex-wrap">
                        <div className="w-24">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pasillo</label>
                            <input 
                                type="text" 
                                maxLength={2}
                                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 uppercase text-center font-bold" 
                                placeholder="A"
                                value={newRackAisle}
                                onChange={e => setNewRackAisle(e.target.value)}
                            />
                        </div>
                        <div className="w-32">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Niveles (Alto)</label>
                            <input 
                                type="number" 
                                min={1} max={10}
                                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500" 
                                value={newRackLevels}
                                onChange={e => setNewRackLevels(parseInt(e.target.value))}
                            />
                        </div>
                        <div className="w-32">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Posiciones (Largo)</label>
                            <input 
                                type="number" 
                                min={1} max={20}
                                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500" 
                                value={newRackPositions}
                                onChange={e => setNewRackPositions(parseInt(e.target.value))}
                            />
                        </div>
                        <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded font-bold shadow flex items-center gap-2">
                            <Plus className="w-4 h-4"/> Crear Rack
                        </button>
                    </form>
                 </div>

                 <div className="mt-8">
                     <h4 className="font-bold text-gray-600 mb-3">Racks Existentes en esta Cámara</h4>
                     {filteredRacks.length === 0 ? (
                         <p className="text-gray-400 italic">No hay racks configurados en esta cámara.</p>
                     ) : (
                         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                             {filteredRacks.map(rack => (
                                 <div key={rack.id} className="bg-white border border-gray-200 rounded p-4 relative group">
                                     <div className="text-center">
                                         <h5 className="font-black text-xl text-slate-800">Pasillo {rack.aisle} - {rack.id}</h5>
                                         <p className="text-sm text-gray-500">{rack.levels} Niveles x {rack.positionsPerLevel} Pos</p>
                                         <p className="text-xs text-gray-400 mt-1">{rack.levels * rack.positionsPerLevel} Ubicaciones</p>
                                     </div>
                                     <button 
                                        onClick={() => onDeleteRack(rack.id)}
                                        className="absolute top-2 right-2 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                     >
                                         <Trash className="w-4 h-4" />
                                     </button>
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>
             </div>
        )}

        {/* BLOCKING TAB */}
        {activeTab === 'BLOCKING' && (
             <div className="space-y-6 max-w-6xl mx-auto h-full flex flex-col">
                 <div className="flex items-center gap-4 bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                    <Lock className="w-6 h-6 text-yellow-600" />
                    <div>
                        <h3 className="font-bold text-yellow-800">Modo de Bloqueo</h3>
                        <p className="text-sm text-yellow-700">Haga clic en las ubicaciones para bloquearlas (gris) o desbloquearlas. Las ubicaciones bloqueadas no permiten asignación de mercadería.</p>
                    </div>
                 </div>

                 <div className="flex items-center gap-4">
                    <label className="font-bold text-gray-700">Ver Cámara:</label>
                    <select 
                        className="p-2 border rounded-lg shadow-sm"
                        value={selectedZoneId}
                        onChange={(e) => setSelectedZoneId(e.target.value)}
                    >
                        {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                 </div>

                 <div className="flex-1 overflow-x-auto border border-dashed border-gray-300 rounded bg-gray-50 p-6">
                    <div className="flex gap-8">
                        {filteredRacks.map(rack => {
                             const levels = Array.from({ length: rack.levels }, (_, i) => rack.levels - i);
                             const positions = Array.from({ length: rack.positionsPerLevel }, (_, i) => i + 1);

                             return (
                                <div key={rack.id} className="flex flex-col gap-1 min-w-max">
                                    <div className="text-center font-bold text-gray-600 mb-1">Rack {rack.id} ({rack.aisle})</div>
                                    <div className="bg-blue-900 p-1 rounded-sm">
                                        <div 
                                            className="grid gap-[2px] bg-blue-900" 
                                            style={{ gridTemplateColumns: `repeat(${rack.positionsPerLevel}, 1fr)` }}
                                        >
                                            {levels.map(level => (
                                                positions.map(pos => {
                                                    const blocked = isSlotBlocked(rack.id, level, pos);
                                                    return (
                                                        <div 
                                                            key={`${level}-${pos}`}
                                                            onClick={() => onToggleBlockSlot(rack.id, level, pos)}
                                                            className={`
                                                                w-6 h-6 border rounded-sm cursor-pointer flex items-center justify-center transition-colors
                                                                ${blocked ? 'bg-gray-400 border-gray-500' : 'bg-white border-blue-200 hover:bg-red-50'}
                                                            `}
                                                            title={`Nivel ${level}, Pos ${pos} - ${blocked ? 'Bloqueado' : 'Disponible'}`}
                                                        >
                                                            {blocked ? <Lock className="w-3 h-3 text-white" /> : <div className="w-1 h-1 bg-blue-100 rounded-full"></div>}
                                                        </div>
                                                    );
                                                })
                                            ))}
                                        </div>
                                    </div>
                                </div>
                             )
                        })}
                    </div>
                 </div>
             </div>
        )}
      </div>
    </div>
  );
};

export default Configuration;