import React, { useState, useEffect, useRef } from 'react';
import { generateLPN, formatDate } from '../utils';
import { Pallet, InventoryItem, Product, MixedItem } from '../types';
import LabelPreview from './LabelPreview';
import { Package, Printer, Scan, Clock, User, ArrowDownToLine, CheckCircle, Search, Info, PlusCircle, Trash, ArrowRightFromLine } from './Icons';

interface ReceptionProps {
  onReceive: (item: InventoryItem) => void;
  lastSequence: number;
  pendingItems: InventoryItem[];
  catalog: Product[];
  currentInventory: InventoryItem[];
  onDeleteItems: (lpns: string[]) => void;
  onBulkDispatch: (lpns: string[]) => void;
}

const Reception: React.FC<ReceptionProps> = ({ 
  onReceive, 
  lastSequence, 
  pendingItems,
  catalog,
  currentInventory,
  onDeleteItems,
  onBulkDispatch
}) => {
  // Form State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [expirationDate, setExpirationDate] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Mixed Pallet State
  const [isMixedMode, setIsMixedMode] = useState(false);
  const [mixedItems, setMixedItems] = useState<MixedItem[]>([]);

  // Validation State
  const [latestStockDate, setLatestStockDate] = useState<string | null>(null);
  const [dateWarning, setDateWarning] = useState<string | null>(null);

  const [generatedPallet, setGeneratedPallet] = useState<Pallet | null>(null);
  const [showLabel, setShowLabel] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selection State for Bulk Delete
  const [selectedLpns, setSelectedLpns] = useState<Set<string>>(new Set());

  // Filter catalog based on search
  const filteredProducts = catalog.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.code.includes(searchTerm)
  );

  // Auto-select if exact code match
  useEffect(() => {
    const exactMatch = catalog.find(p => p.code === searchTerm);
    if (exactMatch && !selectedProduct) {
      handleSelectProduct(exactMatch);
    }
  }, [searchTerm, catalog, selectedProduct]);

  // Check existing inventory when product changes
  useEffect(() => {
    if (selectedProduct) {
        // Find items of this product in inventory (pending or racked)
        const existingItems = currentInventory.filter(i => i.productCode === selectedProduct.code);
        if (existingItems.length > 0) {
            // Find the latest expiration date (we want to ensure new stock is newer than this)
            const dates = existingItems.map(i => new Date(i.expirationDate).getTime());
            const maxDate = new Date(Math.max(...dates));
            setLatestStockDate(maxDate.toISOString().split('T')[0]);
        } else {
            setLatestStockDate(null);
        }
    } else {
        setLatestStockDate(null);
    }
  }, [selectedProduct, currentInventory]);

  // Validate Date on change
  useEffect(() => {
    if (expirationDate && latestStockDate) {
        if (new Date(expirationDate) < new Date(latestStockDate)) {
            setDateWarning('¡ALERTA! Estás recibiendo un producto con vencimiento ANTERIOR a lo que ya tienes en almacén.');
        } else {
            setDateWarning(null);
        }
    } else {
        setDateWarning(null);
    }
  }, [expirationDate, latestStockDate]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchTerm(product.name);
    setIsDropdownOpen(false);
    setDateWarning(null);
  };

  const handleClearProduct = () => {
      setSelectedProduct(null);
      setSearchTerm('');
      setLatestStockDate(null);
      setDateWarning(null);
      setIsDropdownOpen(false);
      if(searchInputRef.current) searchInputRef.current.focus();
  };

  const handleQuickDate = (months: number) => {
      const date = new Date();
      date.setMonth(date.getMonth() + months);
      setExpirationDate(date.toISOString().split('T')[0]);
  };

  const addToMixedPallet = () => {
      if (!selectedProduct || !expirationDate) return;
      
      const newItem: MixedItem = {
          productCode: selectedProduct.code,
          productName: selectedProduct.name,
          quantity: quantity,
          expirationDate: expirationDate
      };

      setMixedItems([...mixedItems, newItem]);
      
      // Reset Form for next item
      setQuantity(1);
      setExpirationDate('');
      handleClearProduct();
  };

  const handleRemoveMixedItem = (index: number) => {
      const newItems = [...mixedItems];
      newItems.splice(index, 1);
      setMixedItems(newItems);
  };

  const finalizeMixedPallet = () => {
      if (mixedItems.length === 0) return;

      // Calculate critical date (earliest expiration)
      const dates = mixedItems.map(i => new Date(i.expirationDate).getTime());
      const minDate = new Date(Math.min(...dates));
      const criticalExpiration = minDate.toISOString().split('T')[0];
      
      const totalQty = mixedItems.reduce((sum, item) => sum + item.quantity, 0);

      const nextSeq = lastSequence + 1;
      const lpn = generateLPN(nextSeq);
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${lpn}`;
      const now = new Date();

      const newPallet: Pallet = {
        lpn,
        productName: `PALLET MIXTO (${mixedItems.length} Refs)`,
        productCode: 'MIXED-PALLET',
        quantity: totalQty,
        expirationDate: criticalExpiration,
        receptionDate: now.toISOString(),
        receivedBy: 'Operador 01',
        qrCodeUrl,
        photoUrl: '', // Default empty
        isMixed: true,
        mixedItems: [...mixedItems]
      };

      onReceive({ ...newPallet, location: null });
      setGeneratedPallet(newPallet);
      setShowLabel(true);
      
      // Reset Mixed Mode
      setMixedItems([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    
    // If in Mixed Mode, just add to list
    if (isMixedMode) {
        addToMixedPallet();
        return;
    }

    // Normal Mode
    const nextSeq = lastSequence + 1;
    const lpn = generateLPN(nextSeq);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${lpn}`;
    const now = new Date();

    const newPallet: Pallet = {
      lpn,
      productName: selectedProduct.name,
      productCode: selectedProduct.code,
      quantity: quantity,
      expirationDate: expirationDate,
      receptionDate: now.toISOString(),
      receivedBy: 'Operador 01',
      qrCodeUrl,
      photoUrl: '', // Default empty
      isMixed: false
    };

    onReceive({ ...newPallet, location: null });
    setGeneratedPallet(newPallet);
    setShowLabel(true);

    setQuantity(1);
    setExpirationDate('');
  };

  // Selection Logic
  const toggleSelectLpn = (lpn: string) => {
      const newSet = new Set(selectedLpns);
      if (newSet.has(lpn)) newSet.delete(lpn);
      else newSet.add(lpn);
      setSelectedLpns(newSet);
  };

  const handleDeleteSelected = () => {
      if (selectedLpns.size === 0) return;
      if (window.confirm(`¿Está seguro que desea ELIMINAR ${selectedLpns.size} items? Esta acción borrará el registro del sistema (corrección de error).`)) {
          onDeleteItems(Array.from(selectedLpns));
          setSelectedLpns(new Set());
      }
  };

  const handleBulkDispatchAction = () => {
      if (selectedLpns.size === 0) return;
      if (window.confirm(`¿Confirmar SALIDA de ${selectedLpns.size} items por venta (Cross-docking)? Esto los retirará del inventario como despachados.`)) {
          onBulkDispatch(Array.from(selectedLpns));
          setSelectedLpns(new Set());
      }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full overflow-hidden">
      
      {/* LEFT: Reception Form */}
      <div className="w-full lg:w-1/2 flex flex-col gap-2 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            
            {/* Mixed Mode Toggle - Compact */}
            <div className="bg-slate-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Package className={`w-4 h-4 ${isMixedMode ? 'text-blue-600' : 'text-gray-400'}`}/>
                    <span className="font-bold text-xs text-gray-700">Modo Pallet Mixto / Saldos</span>
                </div>
                <button 
                    type="button"
                    onClick={() => {
                        setIsMixedMode(!isMixedMode);
                        setMixedItems([]);
                    }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isMixedMode ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isMixedMode ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
            </div>

            <div className="p-4">
                {isMixedMode && (
                    <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <h4 className="font-bold text-blue-800 mb-1 flex items-center gap-2 text-sm">
                            <Info className="w-3 h-3"/> Construyendo Pallet Mixto
                        </h4>
                        
                        {/* Mixed Items List */}
                        {mixedItems.length > 0 && (
                            <div className="bg-white rounded border border-blue-100 overflow-hidden mb-2">
                                <table className="w-full text-xs">
                                    <thead className="bg-blue-100 text-blue-800">
                                        <tr>
                                            <th className="p-1 text-left">Producto</th>
                                            <th className="p-1 text-center">Cant.</th>
                                            <th className="p-1"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mixedItems.map((item, idx) => (
                                            <tr key={idx} className="border-b border-blue-50 last:border-0">
                                                <td className="p-1 truncate max-w-[120px]">{item.productName}</td>
                                                <td className="p-1 text-center">{item.quantity}</td>
                                                <td className="p-1 text-center">
                                                    <button onClick={() => handleRemoveMixedItem(idx)} className="text-red-400 hover:text-red-600">
                                                        <Trash className="w-3 h-3"/>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {mixedItems.length > 0 && (
                            <button 
                                onClick={finalizeMixedPallet}
                                className="w-full py-2 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700 transition-colors text-xs"
                            >
                                Finalizar y Generar LPN Mixto ({mixedItems.length} Refs)
                            </button>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* 1. PRODUCT SEARCH / SCAN */}
                    <div className="space-y-1 relative">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                             Producto (EAN / Nombre)
                        </label>
                        <div className="relative">
                            <input
                                ref={searchInputRef}
                                required={!isMixedMode || mixedItems.length === 0}
                                autoFocus
                                type="text"
                                placeholder="Escanee EAN o escriba nombre..."
                                className={`w-full pl-10 pr-8 py-3 text-base border rounded-lg outline-none transition-all
                                    ${selectedProduct ? 'border-green-500 bg-green-50 text-green-900 font-bold' : 'border-gray-300 focus:border-blue-500'}
                                `}
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    if(selectedProduct && e.target.value !== selectedProduct.name) {
                                        setSelectedProduct(null); // Reset if user changes text
                                    }
                                    setIsDropdownOpen(true);
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                {selectedProduct ? <CheckCircle className="w-5 h-5 text-green-500"/> : <Search className="w-5 h-5"/>}
                            </div>
                            {selectedProduct && (
                                <button 
                                    type="button"
                                    onClick={handleClearProduct}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 font-bold"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Dropdown Results */}
                        {isDropdownOpen && !selectedProduct && searchTerm.length > 0 && (
                            <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                                {filteredProducts.length === 0 ? (
                                    <div className="p-3 text-gray-500 text-center text-sm">No encontrado</div>
                                ) : (
                                    filteredProducts.map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => handleSelectProduct(p)}
                                            className="w-full text-left p-2 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors"
                                        >
                                            <div className="font-bold text-gray-800 text-sm">{p.name}</div>
                                            <div className="text-xs text-gray-500 flex justify-between">
                                                <span>{p.code}</span>
                                                <span className="bg-gray-100 px-2 rounded-full text-[10px]">{p.category}</span>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* 2. DETAILS & VALIDATION */}
                    <div className={`transition-all duration-300 ${selectedProduct ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-2 grayscale pointer-events-none'}`}>
                        
                        {/* Stock Warning */}
                        {latestStockDate && (
                            <div className="mb-2 bg-blue-50 p-2 rounded border border-blue-200 flex items-start gap-2">
                                <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0"/>
                                <div className="text-xs text-blue-800 leading-tight">
                                    <span className="font-bold">Stock en Almacén:</span> Max Venc: {formatDate(latestStockDate)}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Cantidad</label>
                                <input
                                    required
                                    type="number"
                                    min="1"
                                    className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:border-blue-500 outline-none font-bold text-gray-700 text-xl text-center"
                                    value={quantity}
                                    onChange={(e) => setQuantity(parseInt(e.target.value))}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Vencimiento</label>
                                <input
                                    required
                                    type="date"
                                    className={`w-full px-2 py-2 border rounded-lg outline-none font-medium text-sm
                                        ${dateWarning ? 'border-red-500 bg-red-50 text-red-900 focus:ring-red-200' : 'border-gray-300 focus:border-blue-500'}
                                    `}
                                    value={expirationDate}
                                    onChange={(e) => setExpirationDate(e.target.value)}
                                />
                            </div>
                        </div>

                         {/* Error Message */}
                         {dateWarning && (
                            <div className="text-xs text-red-600 font-bold mt-1 leading-tight">
                                {dateWarning}
                            </div>
                        )}

                        {/* Quick Date Buttons */}
                        <div className="mt-2 flex gap-1 flex-wrap justify-center">
                            <button type="button" onClick={() => handleQuickDate(3)} className="px-2 py-1 text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 rounded border border-gray-300 font-bold">+3 M</button>
                            <button type="button" onClick={() => handleQuickDate(6)} className="px-2 py-1 text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 rounded border border-gray-300 font-bold">+6 M</button>
                            <button type="button" onClick={() => handleQuickDate(12)} className="px-2 py-1 text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 rounded border border-gray-300 font-bold">+1 Año</button>
                            <button type="button" onClick={() => handleQuickDate(24)} className="px-2 py-1 text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 rounded border border-gray-300 font-bold">+2 Años</button>
                        </div>

                        <div className="pt-4">
                            <button 
                                type="submit"
                                disabled={!selectedProduct || !expirationDate}
                                className={`w-full flex justify-center items-center gap-2 px-6 py-3 rounded-lg font-bold shadow-lg transform active:scale-[0.99] transition-all
                                    ${isMixedMode 
                                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                                        : dateWarning 
                                            ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                                            : 'bg-blue-600 hover:bg-blue-700 text-white'}
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                `}
                            >
                                {isMixedMode ? <PlusCircle className="w-5 h-5"/> : <Printer className="w-5 h-5" />}
                                {isMixedMode 
                                    ? 'Agregar al Pallet' 
                                    : dateWarning 
                                        ? 'Confirmar (Con Alerta)' 
                                        : 'GENERAR LPN Y RECEPCIONAR'
                                }
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
      </div>

      {/* RIGHT: Pending List (Moved from Sidebar) */}
      <div className="w-full lg:w-1/2 flex flex-col gap-4 h-full">
         <div className="bg-slate-50 rounded-xl border border-gray-200 h-full flex flex-col overflow-hidden shadow-inner">
             {/* Header with Bulk Actions */}
             <div className="p-3 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm">
                 <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2 text-sm">
                        <ArrowDownToLine className="w-4 h-4 text-orange-500"/>
                        Recepción Pendiente
                    </h3>
                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {pendingItems.length}
                    </span>
                 </div>
                 
                 {selectedLpns.size > 0 && (
                     <div className="flex gap-2">
                         <button 
                            onClick={handleBulkDispatchAction}
                            className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-200 transition-colors text-xs font-bold"
                            title="Mercadería vendida (Cross-docking) que no se va a ubicar"
                         >
                             <ArrowRightFromLine className="w-3 h-3"/> Registrar Salida ({selectedLpns.size})
                         </button>
                         <button 
                            onClick={handleDeleteSelected}
                            className="flex items-center gap-1 bg-red-100 text-red-600 px-3 py-1.5 rounded hover:bg-red-200 transition-colors text-xs font-bold"
                            title="Eliminar registro (error)"
                         >
                             <Trash className="w-3 h-3"/> Eliminar ({selectedLpns.size})
                         </button>
                     </div>
                 )}
             </div>
             
             <div className="flex-1 overflow-y-auto p-2 space-y-2">
                 {pendingItems.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                         <Package className="w-12 h-12 mb-2" />
                         <p className="text-sm">Zona de espera vacía</p>
                     </div>
                 ) : (
                     pendingItems.slice().reverse().map((item) => (
                         <div 
                            key={item.lpn} 
                            onClick={() => toggleSelectLpn(item.lpn)}
                            className={`bg-white p-3 rounded-lg border shadow-sm hover:shadow-md transition-all relative group flex gap-3 cursor-pointer ${item.isMixed ? 'border-indigo-200' : 'border-gray-200'} ${selectedLpns.has(item.lpn) ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
                         >
                             {/* Checkbox for selection */}
                             <div className="flex items-center justify-center border-r pr-3 border-gray-100">
                                 <input 
                                    type="checkbox" 
                                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    checked={selectedLpns.has(item.lpn)}
                                    onClick={(e) => e.stopPropagation()} // Prevent double trigger
                                    onChange={() => toggleSelectLpn(item.lpn)}
                                 />
                             </div>

                             <div className="flex-1">
                                <div className="flex justify-between items-start mb-1">
                                    <div>
                                        <h4 className={`font-bold text-sm leading-tight ${item.isMixed ? 'text-indigo-800' : 'text-gray-800'}`}>{item.productName}</h4>
                                        <p className="text-[10px] text-gray-500 font-mono">SKU: {item.productCode}</p>
                                        {item.isMixed && (
                                            <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded uppercase font-bold mt-1 inline-block">Pallet Mixto</span>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span className="block font-mono font-black text-sm text-slate-700 tracking-wider">{item.lpn}</span>
                                        <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">x{item.quantity}</span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4 text-[10px] text-gray-500 border-t pt-1 mt-1">
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(item.receptionDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        {item.receivedBy}
                                    </div>
                                </div>
                             </div>
                             
                             {/* Decoration for status */}
                             <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${item.isMixed ? 'bg-indigo-500' : 'bg-orange-400'}`}></div>
                         </div>
                     ))
                 )}
             </div>
         </div>
      </div>

      {/* MODAL: Label Preview */}
      {showLabel && generatedPallet && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-center md:p-4">
            <div className="bg-white md:rounded-lg shadow-2xl w-full h-full md:h-auto md:max-w-2xl md:max-h-[90vh] flex flex-col overflow-hidden">
                <LabelPreview 
                    pallet={generatedPallet} 
                    onClose={() => setShowLabel(false)} 
                />
            </div>
          </div>
      )}
    </div>
  );
};

export default Reception;