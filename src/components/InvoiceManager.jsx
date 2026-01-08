import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { FileText, Plus, Trash2, Settings, Printer, Download, ArrowLeft, Send, CheckCircle, XCircle, Clock } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import CompanySettings from './CompanySettings';

// --- SERVICE CATALOG ---
const PACKAGES = [
  { name: 'Web Dev: Basic', rate: 1500, desc: '5 Page Responsive Website' },
  { name: 'Web Dev: E-Commerce', rate: 3500, desc: 'Shopify/WooCommerce Setup with 20 Products' },
  { name: 'SEO: Monthly Starter', rate: 800, desc: 'Keyword analysis, Blog Content, Backlinking' },
  { name: 'App Dev: MVP', rate: 5000, desc: 'React Native iOS/Android App Core Features' },
  { name: 'Consulting: Strategy', rate: 200, desc: 'Hourly Technical consultation' },
  { name: 'Maintenance: Server', rate: 100, desc: 'Monthly Uptime & Security Patching' }
];

export default function InvoiceManager() {
  const [view, setView] = useState('LIST');
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [company, setCompany] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    type: 'Invoice', 
    client: '', 
    items: [{ desc: '', qty: 1, rate: 0 }], 
    notes: '', 
    status: 'Draft',
    date: new Date().toISOString().split('T')[0],
    validUntil: '' // New Field for Quotes
  });

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'invoices'), s => setInvoices(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const u2 = onSnapshot(collection(db, 'clients'), s => setClients(s.docs.map(d => d.data().name)));
    getDoc(doc(db, 'settings', 'companyProfile')).then(s => { if(s.exists()) setCompany(s.data()); });
    return () => { u1(); u2(); };
  }, [view]);

  // --- ACTIONS ---
  const handleItemChange = (idx, field, val) => {
    const newItems = [...formData.items];
    newItems[idx][field] = val;
    setFormData({ ...formData, items: newItems });
  };

  const addPackage = (pkgName) => {
    const pkg = PACKAGES.find(p => p.name === pkgName);
    if(pkg) setFormData({
        ...formData, 
        items: [...formData.items, { desc: pkg.name + ' - ' + pkg.desc, qty: 1, rate: pkg.rate }]
    });
  };

  const saveDoc = async () => {
    if(!formData.client) return alert("Please select a client");
    const total = formData.items.reduce((acc, i) => acc + (i.qty * i.rate), 0);
    
    // Auto-set validUntil if empty for quotes
    let finalData = { ...formData, total };
    if((formData.type === 'Quote' || formData.type === 'Proposal') && !formData.validUntil) {
        const d = new Date(); d.setDate(d.getDate() + 30); // Default 30 days
        finalData.validUntil = d.toISOString().split('T')[0];
    }

    await addDoc(collection(db, 'invoices'), finalData);
    setView('LIST');
    setFormData({ type: 'Invoice', client: '', items: [{ desc: '', qty: 1, rate: 0 }], notes: '', status: 'Draft', date: new Date().toISOString().split('T')[0], validUntil: '' });
  };

  const updateStatus = async (id, newStatus) => {
    await updateDoc(doc(db, 'invoices', id), { status: newStatus });
  };

  // --- ROBUST PDF GENERATOR ---
  const generatePDF = (inv) => {
    try {
        const doc = new jsPDF();
        const brand = company || { name: 'Your Company', email: 'Please configure branding' };

        // 1. SAFE LOGO LOADING
        if (brand.logoUrl) { 
            try { 
                doc.addImage(brand.logoUrl, 'JPEG', 15, 15, 25, 25); 
            } catch(e){
                console.warn("Logo failed to load in PDF", e);
            } 
        }

        // 2. HEADER INFO
        doc.setFontSize(22); doc.setTextColor(40);
        doc.text(brand.name || "Company Name", 195, 25, { align: 'right' });
        
        doc.setFontSize(10); doc.setTextColor(100);
        doc.text(brand.email || "", 195, 32, { align: 'right' });
        doc.text(brand.address || "", 195, 37, { align: 'right' });
        doc.text(brand.phone || "", 195, 42, { align: 'right' });
        doc.text(brand.website || "", 195, 47, { align: 'right' });

        // 3. DOCUMENT TITLE & CLIENT
        doc.setFontSize(18); doc.setTextColor(79, 70, 229);
        doc.text(inv.type.toUpperCase(), 15, 60);

        doc.setFontSize(11); doc.setTextColor(0);
        doc.text("Bill To:", 15, 70);
        doc.setFont("helvetica", "bold");
        doc.text(inv.client, 15, 75);
        doc.setFont("helvetica", "normal");
        
        // Dates
        doc.text(`Date: ${inv.date}`, 195, 70, { align: 'right' });
        if(inv.validUntil) {
             doc.setTextColor(220, 38, 38); // Red for deadlines
             doc.text(`Valid Until: ${inv.validUntil}`, 195, 75, { align: 'right' });
             doc.setTextColor(0);
        }
        doc.text(`Status: ${inv.status}`, 195, 80, { align: 'right' });

        // 4. ITEMS TABLE
        doc.autoTable({
            startY: 90,
            head: [['Description', 'Qty', 'Rate', 'Amount']],
            body: inv.items.map(i => [i.desc, i.qty, `$${i.rate}`, `$${(i.qty*i.rate).toFixed(2)}`]),
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] },
            styles: { fontSize: 10, cellPadding: 3 }
        });

        // 5. TOTALS
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text(`Total: $${inv.total?.toFixed(2)}`, 195, finalY, { align: 'right' });

        // 6. NOTES
        if(inv.notes) {
            doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
            doc.text("Terms & Notes:", 15, finalY + 15);
            doc.text(inv.notes, 15, finalY + 20, { maxWidth: 180 });
        }
        
        doc.save(`${inv.client}_${inv.type}.pdf`);
    } catch (error) {
        alert("Error generating PDF. Please check your logo or try again.");
        console.error(error);
    }
  };

  // --- VIEWS ---
  if (view === 'SETTINGS') return (
    <div className="max-w-4xl mx-auto">
        <button onClick={() => setView('LIST')} className="mb-6 btn btn-ghost text-slate-500">
            <ArrowLeft size={16} className="mr-2"/> Back to Invoices
        </button>
        <CompanySettings onClose={() => setView('LIST')} />
    </div>
  );
  
  if (view === 'CREATE') return (
    <div className="max-w-5xl mx-auto bg-white p-8 rounded-xl border border-border shadow-xl animate-in slide-in-from-bottom-4">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h2 className="text-2xl font-bold">New {formData.type}</h2>
            <button onClick={() => setView('LIST')} className="btn btn-ghost">Cancel</button>
        </div>
        
        {/* Document Header */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 bg-slate-50 p-6 rounded-xl border border-slate-100">
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Doc Type</label>
                <select className="input-field bg-white" value={formData.type} onChange={e=>setFormData({...formData, type:e.target.value})}>
                    <option>Invoice</option><option>Quote</option><option>Proposal</option>
                </select>
            </div>
            <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Client</label>
                <select className="input-field bg-white" value={formData.client} onChange={e=>setFormData({...formData, client:e.target.value})}>
                    <option value="">Select Client...</option>
                    {clients.map(c => <option key={c}>{c}</option>)}
                </select>
            </div>
            <div>
                 <label className="text-xs font-bold text-slate-500 uppercase block mb-2">
                    {formData.type === 'Invoice' ? 'Due Date' : 'Valid Until'}
                 </label>
                 <input type="date" className="input-field bg-white" value={formData.validUntil} onChange={e=>setFormData({...formData, validUntil:e.target.value})} />
            </div>
        </div>

        {/* Line Items */}
        <div className="mb-8">
            <h3 className="font-bold text-slate-700 mb-4">Line Items</h3>
            
            {/* Quick Add Buttons */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                {PACKAGES.map(p => (
                    <button key={p.name} onClick={() => addPackage(p.name)} className="btn-xs bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold hover:bg-indigo-100 transition-colors">
                        + {p.name}
                    </button>
                ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-3 bg-slate-100 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                    <div className="col-span-6">Description</div>
                    <div className="col-span-2">Qty</div>
                    <div className="col-span-2">Rate</div>
                    <div className="col-span-2 text-right">Total</div>
                </div>
                {formData.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-4 p-3 items-center border-b border-slate-50 last:border-0">
                        <div className="col-span-6"><input className="input-field mb-0" value={item.desc} onChange={e=>handleItemChange(idx, 'desc', e.target.value)} placeholder="Item Description" /></div>
                        <div className="col-span-2"><input className="input-field mb-0" type="number" value={item.qty} onChange={e=>handleItemChange(idx, 'qty', parseInt(e.target.value))} /></div>
                        <div className="col-span-2"><input className="input-field mb-0" type="number" value={item.rate} onChange={e=>handleItemChange(idx, 'rate', parseFloat(e.target.value))} /></div>
                        <div className="col-span-1 text-right font-bold text-slate-600 pt-2">${(item.qty * item.rate).toFixed(0)}</div>
                        <div className="col-span-1 text-right"><button onClick={() => {const ni = [...formData.items]; ni.splice(idx,1); setFormData({...formData, items:ni})}} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></div>
                    </div>
                ))}
            </div>
            <button onClick={() => setFormData({...formData, items:[...formData.items, {desc:'', qty:1, rate:0}]})} className="mt-3 btn btn-outline btn-sm border-dashed">
                <Plus size={14} className="mr-2"/> Add Custom Item
            </button>
        </div>

        {/* Footer */}
        <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-1 w-full">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Terms / Notes</label>
                <textarea className="input-field h-32" placeholder="e.g. Payment required within 14 days. Wire transfer details..." value={formData.notes} onChange={e=>setFormData({...formData, notes:e.target.value})}></textarea>
            </div>
            <div className="w-full md:w-1/3 bg-slate-50 p-6 rounded-xl border border-slate-100">
                <div className="flex justify-between mb-2">
                    <span className="text-sm text-slate-500">Subtotal</span>
                    <span className="font-bold">${formData.items.reduce((acc, i) => acc + (i.qty * i.rate), 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-4 mt-2">
                    <span className="text-lg font-bold text-slate-700">Total</span>
                    <span className="text-3xl font-bold text-primary">${formData.items.reduce((acc, i) => acc + (i.qty * i.rate), 0).toFixed(2)}</span>
                </div>
                <button onClick={saveDoc} className="btn btn-primary w-full mt-6 py-3 text-lg shadow-lg shadow-indigo-200">Save {formData.type}</button>
            </div>
        </div>
    </div>
  );

  // DEFAULT LIST VIEW
  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h2 className="text-3xl font-bold text-text-main tracking-tight">Financials</h2>
            <p className="text-text-sec mt-1">Manage quotes, proposals, and invoices.</p>
        </div>
        <div className="flex gap-3">
            <button onClick={() => setView('SETTINGS')} className="btn btn-outline bg-white"><Settings size={16} className="mr-2"/> Branding</button>
            <button onClick={() => setView('CREATE')} className="btn btn-primary shadow-lg shadow-indigo-200"><Plus size={16} className="mr-2"/> New Document</button>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden flex-1">
        <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-border text-xs uppercase text-slate-500 font-bold">
                <tr>
                    <th className="p-4 w-[120px]">Date</th>
                    <th className="p-4 w-[250px]">Client</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Status & Action</th>
                    <th className="p-4 text-right">Options</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-border">
                {invoices.length === 0 && (
                    <tr><td colSpan="6" className="p-12 text-center text-text-sec">No documents yet. Create one to get started.</td></tr>
                )}
                {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50 group transition-colors">
                        <td className="p-4 text-sm font-mono text-slate-500">{inv.date}</td>
                        <td className="p-4 font-bold text-slate-800">{inv.client}</td>
                        <td className="p-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                inv.type === 'Quote' ? 'bg-purple-50 text-purple-700 border-purple-200' : 
                                inv.type === 'Proposal' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>{inv.type}</span>
                        </td>
                        <td className="p-4 font-mono font-bold text-slate-700">${inv.total?.toFixed(2)}</td>
                        
                        {/* DYNAMIC STATUS BUTTONS */}
                        <td className="p-4">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${
                                    inv.status === 'Paid' || inv.status === 'Approved' ? 'bg-emerald-500' : 
                                    inv.status === 'Sent' ? 'bg-blue-500' : 'bg-slate-300'
                                }`}></span>
                                <span className="text-sm font-semibold mr-2 w-[60px]">{inv.status}</span>
                                
                                {inv.status === 'Draft' && (
                                    <button onClick={() => updateStatus(inv.id, 'Sent')} className="btn-xs bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                                        <Send size={10}/> Mark Sent
                                    </button>
                                )}
                                {(inv.status === 'Sent' || inv.status === 'Draft') && (
                                    <button onClick={() => updateStatus(inv.id, inv.type === 'Invoice' ? 'Paid' : 'Approved')} className="btn-xs bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-600 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                                        <CheckCircle size={10}/> {inv.type === 'Invoice' ? 'Mark Paid' : 'Approve'}
                                    </button>
                                )}
                            </div>
                        </td>

                        <td className="p-4 flex justify-end gap-2">
                            <button onClick={() => generatePDF(inv)} className="btn-icon w-8 h-8 text-slate-500 hover:text-primary hover:bg-indigo-50" title="Download PDF">
                                <Download size={16}/>
                            </button>
                            <button onClick={async () => { if(confirm("Delete?")) await deleteDoc(doc(db, 'invoices', inv.id)) }} className="btn-icon w-8 h-8 text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                                <Trash2 size={16}/>
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}