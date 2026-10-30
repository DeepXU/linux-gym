import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Server, Cloud, Cpu, Box, Globe, ShieldCheck, Lock, CheckCircle, Users, RefreshCw, Key, Edit, Trash, Plus, FileText, HelpCircle, Flag, Download, Upload, Layers } from 'lucide-react';
import { AIConfig, AIProvider, User, Level, Difficulty, FormalRun, ResearchConfiguration } from '../types';
import { authService } from '../services/authService';
import { levelService } from '../services/levelService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  onSave: (config: AIConfig) => void;
  onLevelsChange?: () => void; // New callback for level updates
  isAdmin?: boolean;
}

type TabType = AIProvider | 'security' | 'users' | 'levels' | 'research';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
  onLevelsChange,
  isAdmin = false
}) => {
  const [localConfig, setLocalConfig] = useState<AIConfig>(config);
  const [activeTab, setActiveTab] = useState<TabType>(config.provider);
  
  // Password Change State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // User Management State
  const [studentList, setStudentList] = useState<User[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [resetPassValue, setResetPassValue] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  // Level Editor State
  const [levels, setLevels] = useState<Level[]>([]);
  const [editingLevel, setEditingLevel] = useState<Level | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalConfig(config);
    setActiveTab(config.provider);
    setPasswordMsg(null);
    setNewPassword('');
    setConfirmPassword('');
    
    // Refresh lists when opening
    if (isOpen) {
       setStudentList(authService.getAllStudents());
       setLevels(levelService.getLevels());
       setSelectedStudent(null);
       setResetPassValue('');
       setResetMsg('');
       setIsEditing(false);
       setEditingLevel(null);
       fetchActiveRun();
    }
  }, [config, isOpen]);

  // Research State
  const [activeRun, setActiveRun] = useState<FormalRun | null>(null);
  const [exportRunFilter, setExportRunFilter] = useState('');
  const [exportStripFreeText, setExportStripFreeText] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fetchActiveRun = async () => {
    try {
      const res = await authService.fetchAuthenticated('/api/runs/active');
      if (res.ok) {
        const data = await res.json();
        setActiveRun(data);
      }
    } catch (e) {
      console.error('Failed to fetch active run:', e);
    }
  };

  const handleDownloadResearchPackage = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (exportRunFilter) params.append('runId', exportRunFilter);
      if (exportStripFreeText) params.append('stripFreeText', 'true');
      
      const response = await authService.fetchAuthenticated(`/api/export/research-package?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to generate export package');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `research_package_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      alert('Export failed: ' + e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...localConfig, provider: (activeTab === 'security' || activeTab === 'users' || activeTab === 'levels' || activeTab === 'research') ? config.provider : activeTab });
    onClose();
  };

  const handleChangePassword = () => {
    setPasswordMsg({
      type: 'error',
      text: 'Password changes are enforced on the server. This client does not store or mutate admin passwords locally.'
    });
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleResetStudentPass = async () => {
    if (!selectedStudent || !resetPassValue) return;
    try {
      await authService.resetStudentPassword(selectedStudent, resetPassValue);
      setResetMsg(`Success: Password for ${selectedStudent} reset.`);
      setResetPassValue('');
      setTimeout(() => setResetMsg(''), 3000);
    } catch (e: any) {
      setResetMsg(`Error: ${e.message}`);
    }
  };

  // --- LEVEL EDITOR HANDLERS ---

  const handleStartEdit = (level: Level) => {
    setEditingLevel({ ...level }); // Clone to avoid direct ref mutation
    setIsEditing(true);
  };

  const handleCreateNewLevel = () => {
    setEditingLevel({
      id: 0, // 0 indicates new
      title: 'New Challenge',
      description: 'Describe the scenario here...',
      difficulty: Difficulty.EASY,
      objective: 'What must the user do?',
      flag: 'FLAG{new_flag_here}',
      systemContext: 'User: cadet\nCWD: /home/cadet\nFile System:\n...',
      hints: ['Hint 1', 'Hint 2'],
      isPostTest: false
    });
    setIsEditing(true);
  };

  const handleSaveLevel = () => {
    if (!editingLevel) return;
    const updatedList = levelService.saveLevel(editingLevel);
    setLevels(updatedList);
    setIsEditing(false);
    setEditingLevel(null);
    if (onLevelsChange) onLevelsChange();
  };

  const handleDeleteLevel = (id: number) => {
    if (window.confirm('Are you sure you want to delete this level? This cannot be undone.')) {
      const updatedList = levelService.deleteLevel(id);
      setLevels(updatedList);
      if (onLevelsChange) onLevelsChange();
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all levels to default? Custom levels will be lost.')) {
      const defaults = levelService.resetDefaults();
      setLevels(defaults);
      if (onLevelsChange) onLevelsChange();
    }
  };

  const handleExportLevels = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(levels, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `linux_gym_levels_backup.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportClick = () => {
     fileInputRef.current?.click();
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
     const file = event.target.files?.[0];
     if (!file) return;

     const reader = new FileReader();
     reader.onload = (e) => {
        try {
           const content = e.target?.result as string;
           const imported = JSON.parse(content);
           if (Array.isArray(imported) && imported.length > 0 && imported[0].id && imported[0].title) {
               if (window.confirm(`Importing ${imported.length} levels. This will overwrite current levels. Continue?`)) {
                   const newList = levelService.importLevels(imported);
                   setLevels(newList);
                   if (onLevelsChange) onLevelsChange();
               }
           } else {
               alert("Invalid file format. Expected an array of Level objects.");
           }
        } catch (err) {
            alert("Error parsing JSON file.");
        }
     };
     reader.readAsText(file);
     event.target.value = ''; // Reset input
  };

  if (!isOpen) return null;

  const renderTabButton = (id: TabType, label: string, icon: React.ReactNode, colorClass: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all h-24 ${
        activeTab === id
          ? `${colorClass} ring-1 ring-offset-1 ring-offset-slate-900 ring-white/20`
          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750 hover:border-slate-600'
      }`}
    >
      <div className="mb-2">{icon}</div>
      <span className="text-[10px] font-bold text-center leading-tight">{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950">
          <div>
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <ShieldCheck className="text-emerald-500" size={20} /> 
              {isAdmin ? 'Admin Configuration' : 'AI Configuration'}
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              {isAdmin ? 'Configure AI backends, manage security credentials, or user accounts.' : 'Configure your AI backend.'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Provider Grid (Ollama Local Default First) */}
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-8">
            {renderTabButton('ollama', 'Ollama (Default)', <Server size={20} />, 'bg-orange-600/20 border-orange-500 text-orange-200')}
            {renderTabButton('custom', 'Local vLLM', <Box size={20} />, 'bg-slate-600/20 border-slate-400 text-slate-200')}
            {renderTabButton('gemini', 'Gemini', <Cloud size={20} />, 'bg-blue-600/20 border-blue-500 text-blue-200')}
            {renderTabButton('openai', 'OpenAI', <Globe size={20} />, 'bg-emerald-600/20 border-emerald-500 text-emerald-200')}
            {renderTabButton('anthropic', 'Claude', <Cpu size={20} />, 'bg-purple-600/20 border-purple-500 text-purple-200')}
            {isAdmin && renderTabButton('levels', 'Levels', <FileText size={20} />, 'bg-yellow-600/20 border-yellow-500 text-yellow-200')}
            {isAdmin && renderTabButton('users', 'Users', <Users size={20} />, 'bg-indigo-600/20 border-indigo-500 text-indigo-200')}
            {isAdmin && renderTabButton('security', 'Security', <Lock size={20} />, 'bg-red-600/20 border-red-500 text-red-200')}
            {isAdmin && renderTabButton('research', 'Research', <Layers size={20} />, 'bg-rose-600/20 border-rose-500 text-rose-200')}
          </div>

          {/* Config Fields Area */}
          <div className="bg-slate-950/50 rounded-lg border border-slate-800 p-5 space-y-4">
            
            {/* LEVEL EDITOR TAB */}
            {activeTab === 'levels' && (
              <div className="h-[500px] flex flex-col">
                 {!isEditing ? (
                   <>
                     <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                        <label className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Level Editor ({levels.length})</label>
                        <div className="flex gap-2 flex-wrap">
                           {/* Hidden Import Input */}
                          <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".json" className="hidden" />
                          
                          <button onClick={handleImportClick} className="text-slate-400 hover:text-white text-xs flex items-center gap-1 px-2 py-1 border border-slate-700 rounded bg-slate-900" title="Import JSON">
                             <Upload size={12} /> Import
                          </button>
                          <button onClick={handleExportLevels} className="text-slate-400 hover:text-white text-xs flex items-center gap-1 px-2 py-1 border border-slate-700 rounded bg-slate-900" title="Export JSON">
                             <Download size={12} /> Export
                          </button>
                          <div className="w-px h-6 bg-slate-700 mx-1"></div>
                          <button onClick={handleResetDefaults} className="text-slate-500 hover:text-red-400 text-xs flex items-center gap-1 px-2 py-1">
                             <RefreshCw size={12} /> Reset Defaults
                          </button>
                          <button 
                             onClick={handleCreateNewLevel}
                             className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors"
                          >
                             <Plus size={14} /> Add New Level
                          </button>
                        </div>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto border border-slate-800 rounded-lg bg-slate-900">
                        <table className="w-full text-left text-xs">
                           <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0">
                              <tr>
                                 <th className="p-3 w-10">ID</th>
                                 <th className="p-3">Title</th>
                                 <th className="p-3">Difficulty</th>
                                 <th className="p-3">Flag</th>
                                 <th className="p-3 text-right">Actions</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-800/50">
                              {levels.map(l => (
                                 <tr key={l.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="p-3 text-slate-500 font-mono">{l.id}</td>
                                    <td className="p-3 font-medium text-slate-200">{l.title}</td>
                                    <td className="p-3">
                                      <span className={`px-1.5 py-0.5 rounded ${
                                        l.difficulty === Difficulty.EASY ? 'bg-green-900/30 text-green-400' :
                                        l.difficulty === Difficulty.MEDIUM ? 'bg-yellow-900/30 text-yellow-400' :
                                        'bg-red-900/30 text-red-400'
                                      }`}>{l.difficulty}</span>
                                    </td>
                                    <td className="p-3 font-mono text-slate-500 truncate max-w-[150px]">{l.flag}</td>
                                    <td className="p-3 text-right flex justify-end gap-2">
                                       <button onClick={() => handleStartEdit(l)} className="p-1 hover:bg-slate-700 rounded text-blue-400" title="Edit">
                                          <Edit size={14} />
                                       </button>
                                       <button onClick={() => handleDeleteLevel(l.id)} className="p-1 hover:bg-slate-700 rounded text-red-400" title="Delete">
                                          <Trash size={14} />
                                       </button>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                   </>
                 ) : (
                   /* EDIT FORM */
                   <div className="flex flex-col h-full animate-in fade-in">
                      <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                         <h3 className="font-bold text-white flex items-center gap-2">
                           <Edit size={16} className="text-yellow-400" /> 
                           {editingLevel?.id === 0 ? 'Create New Level' : `Edit Level ${editingLevel?.id}`}
                         </h3>
                         <div className="flex gap-2">
                            <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-slate-400 hover:text-white text-xs">Cancel</button>
                            <button onClick={handleSaveLevel} className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-xs font-bold flex items-center gap-1">
                               <Save size={14} /> Save Changes
                            </button>
                         </div>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                               <label className="block text-[10px] text-slate-400 mb-1">Title</label>
                               <input 
                                 type="text" 
                                 value={editingLevel?.title} 
                                 onChange={e => setEditingLevel(prev => prev ? {...prev, title: e.target.value} : null)}
                                 className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm focus:border-yellow-500 outline-none"
                               />
                            </div>
                            <div>
                               <label className="block text-[10px] text-slate-400 mb-1">Difficulty</label>
                               <select 
                                 value={editingLevel?.difficulty} 
                                 onChange={e => setEditingLevel(prev => prev ? {...prev, difficulty: e.target.value as Difficulty} : null)}
                                 className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm focus:border-yellow-500 outline-none"
                               >
                                  <option value={Difficulty.EASY}>Easy</option>
                                  <option value={Difficulty.MEDIUM}>Medium</option>
                                  <option value={Difficulty.HARD}>Hard</option>
                               </select>
                            </div>
                         </div>

                         <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Objective (What user sees)</label>
                            <input 
                              type="text" 
                              value={editingLevel?.objective} 
                              onChange={e => setEditingLevel(prev => prev ? {...prev, objective: e.target.value} : null)}
                              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm focus:border-yellow-500 outline-none"
                            />
                         </div>

                         <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Scenario Description</label>
                            <textarea 
                              value={editingLevel?.description} 
                              onChange={e => setEditingLevel(prev => prev ? {...prev, description: e.target.value} : null)}
                              rows={2}
                              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm focus:border-yellow-500 outline-none resize-none"
                            />
                         </div>

                         <div className="grid grid-cols-2 gap-4">
                            <div>
                               <label className="block text-[10px] text-slate-400 mb-1">Flag Answer</label>
                               <div className="relative">
                                 <Flag size={14} className="absolute top-2.5 left-2.5 text-slate-500" />
                                 <input 
                                    type="text" 
                                    value={editingLevel?.flag} 
                                    onChange={e => setEditingLevel(prev => prev ? {...prev, flag: e.target.value} : null)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 pl-8 text-sm focus:border-yellow-500 outline-none font-mono text-green-400"
                                 />
                               </div>
                            </div>
                            <div>
                               <label className="block text-[10px] text-slate-400 mb-1">Retention Mode</label>
                               <label className="flex items-center gap-2 cursor-pointer bg-slate-900 border border-slate-700 rounded px-2 h-[38px] text-sm text-slate-300">
                                  <input 
                                    type="checkbox" 
                                    checked={!!editingLevel?.isPostTest}
                                    onChange={(e) => setEditingLevel(prev => prev ? {...prev, isPostTest: e.target.checked} : null)}
                                    className="w-4 h-4 rounded bg-slate-800 border-slate-700 accent-yellow-500"
                                  />
                                  Post-Test (Forces AI 'None')
                               </label>
                            </div>
                         </div>
                         <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Hints (Line separated)</label>
                            <textarea 
                               value={editingLevel?.hints.join('\n')} 
                               onChange={e => setEditingLevel(prev => prev ? {...prev, hints: e.target.value.split('\n')} : null)}
                               rows={1}
                               className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm focus:border-yellow-500 outline-none resize-none"
                               placeholder="One hint per line"
                            />
                         </div>

                         <div>
                            <div className="flex justify-between items-center mb-1">
                               <label className="block text-[10px] text-slate-400">System Context (Hidden Prompt for AI)</label>
                               <span className="text-[10px] text-yellow-500 flex items-center gap-1"><HelpCircle size={10} /> Defines the live execution environment</span>
                            </div>
                            <textarea 
                              value={editingLevel?.systemContext} 
                              onChange={e => setEditingLevel(prev => prev ? {...prev, systemContext: e.target.value} : null)}
                              rows={6}
                              className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-xs font-mono text-slate-300 focus:border-yellow-500 outline-none leading-relaxed"
                            />
                         </div>
                      </div>
                   </div>
                 )}
              </div>
            )}

            {activeTab === 'users' && (
               <div className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                     <label className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Registered Users ({studentList.length})</label>
                     <button onClick={() => setStudentList(authService.getAllStudents())} className="text-slate-400 hover:text-white">
                        <RefreshCw size={14} />
                     </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* User List */}
                     <div className="border border-slate-800 rounded-lg bg-slate-900 overflow-hidden h-64 overflow-y-auto">
                        {studentList.length === 0 ? (
                           <div className="p-4 text-center text-slate-500 text-xs italic">No registered users found.</div>
                        ) : (
                           <table className="w-full text-left text-xs">
                              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0">
                                 <tr>
                                    <th className="p-3 font-medium">Username</th>
                                    <th className="p-3 font-medium">ID</th>
                                    <th className="p-3 font-medium">Condition</th>
                                    <th className="p-3 font-medium text-right">Action</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/50">
                                 {studentList.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                                       <td className="p-3 font-medium text-slate-200">{u.username}</td>
                                       <td className="p-3 text-slate-500 font-mono text-[10px]">{u.id}</td>
                                       <td className="p-3">
                                          <select 
                                            value={u.condition || 'guided'}
                                            onChange={(e) => {
                                               authService.updateStudentCondition(u.username, e.target.value as any);
                                               setStudentList(authService.getAllStudents());
                                            }}
                                            className="bg-slate-950 border border-slate-700 rounded text-xs p-1 text-slate-300 outline-none focus:border-indigo-500"
                                          >
                                            <option value="guided">Guided AI</option>
                                            <option value="unguided">Unguided AI</option>
                                            <option value="none">No AI (Shell)</option>
                                          </select>
                                       </td>
                                       <td className="p-3 text-right">
                                          <button 
                                             onClick={() => { setSelectedStudent(u.username); setResetMsg(''); }}
                                             className="px-2 py-1 bg-indigo-900/30 text-indigo-300 rounded hover:bg-indigo-800/50 transition-colors border border-indigo-800"
                                          >
                                             Edit
                                          </button>
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        )}
                     </div>

                     {/* Reset Action Panel */}
                     <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-center">
                        {selectedStudent ? (
                           <div className="space-y-4 animate-in fade-in">
                              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                                 <div className="p-2 bg-indigo-500/10 rounded-full">
                                    <Key size={16} className="text-indigo-400" />
                                 </div>
                                 <div>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">Reset Password For</p>
                                    <p className="text-sm font-bold text-white">{selectedStudent}</p>
                                 </div>
                              </div>
                              
                              <div>
                                 <label className="block text-[10px] text-slate-400 mb-1">New Password</label>
                                 <input
                                    type="text"
                                    value={resetPassValue}
                                    onChange={(e) => setResetPassValue(e.target.value)}
                                    placeholder="Enter new password"
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm focus:border-indigo-500 outline-none"
                                 />
                              </div>

                              <button 
                                 onClick={handleResetStudentPass}
                                 className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded text-xs font-bold transition-colors"
                              >
                                 Reset Password
                              </button>

                              {resetMsg && (
                                 <p className={`text-[10px] text-center ${resetMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
                                    {resetMsg}
                                 </p>
                              )}
                           </div>
                        ) : (
                           <div className="text-center text-slate-500 space-y-2">
                              <Users size={32} className="mx-auto opacity-20" />
                              <p className="text-xs">Select a user from the list to manage their account.</p>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-4">
                 <label className="text-xs font-semibold text-red-400 uppercase tracking-wider">Administrative Security</label>

                 <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-4 space-y-3">
                   <p className="text-xs text-red-200 font-medium">Server-side credentials only</p>
                   <p className="text-xs text-slate-300 leading-relaxed">
                     Password changes are enforced by the authenticated server configuration. The client no longer stores or mutates administrator credentials in browser memory.
                   </p>
                   <p className="text-[10px] text-slate-400">
                     Configure <span className="font-mono text-slate-300">ADMIN_INITIAL_PASSWORD</span> at startup or rotate credentials with an authenticated admin endpoint before launch.
                   </p>
                 </div>

                 {passwordMsg && (
                   <div className={`text-xs p-2 rounded flex items-center gap-2 ${
                     passwordMsg.type === 'success' ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20'
                   }`}>
                     {passwordMsg.type === 'success' && <CheckCircle size={14} />}
                     {passwordMsg.text}
                   </div>
                 )}

                 <div className="pt-2">
                   <button 
                     type="button" 
                     onClick={handleChangePassword}
                     className="bg-red-900/30 hover:bg-red-900/50 text-red-200 border border-red-900/50 text-xs px-4 py-2 rounded transition-colors"
                   >
                     Show Security Guidance
                   </button>
                 </div>
              </div>
            )}

            {activeTab === 'gemini' && (
              <div className="space-y-3">
                <label className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Google Gemini Config</label>
                <input
                  type="password"
                  placeholder="API Key (Leave empty to use ENV)"
                  value={localConfig.apiKey || ''}
                  onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm focus:border-blue-500 outline-none transition-colors"
                />
                <p className="text-[10px] text-slate-500">Gemini is optional; the local Ollama configuration is the current default.</p>
              </div>
            )}

            {activeTab === 'ollama' && (
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <label className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Local Ollama Config</label>
                   <div className="flex items-center gap-1.5">
                     <span className="text-[10px] text-slate-400">Endpoint Preset:</span>
                     <button
                       type="button"
                       onClick={() => setLocalConfig({ ...localConfig, ollamaUrl: 'http://localhost:2004' })}
                       className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                         localConfig.ollamaUrl === 'http://localhost:2004'
                           ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                           : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                       }`}
                     >
                       :2004 (Lab)
                     </button>
                     <button
                       type="button"
                       onClick={() => setLocalConfig({ ...localConfig, ollamaUrl: 'http://127.0.0.1:11434' })}
                       className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                         localConfig.ollamaUrl === 'http://127.0.0.1:11434'
                           ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                           : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                       }`}
                     >
                       Standard Ollama
                     </button>
                   </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Endpoint URL</label>
                      <input
                        type="text"
                        value={localConfig.ollamaUrl}
                        onChange={(e) => setLocalConfig({ ...localConfig, ollamaUrl: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm focus:border-orange-500 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Tutor Model Name</label>
                      <input
                        type="text"
                        value={localConfig.ollamaModel}
                        placeholder="qwen3-coder:30b"
                        onChange={(e) => setLocalConfig({ ...localConfig, ollamaModel: e.target.value, tutorModel: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm focus:border-orange-500 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Safety Guard Model (Layer 1/2)</label>
                      <input
                        type="text"
                        value={localConfig.llamaGuardModel || 'llama-guard3:1b'}
                        placeholder="llama-guard3:1b or llama3.1:8b"
                        onChange={(e) => setLocalConfig({ ...localConfig, llamaGuardModel: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm focus:border-orange-500 outline-none font-mono"
                      />
                    </div>
                 </div>

                 <div className="p-3 bg-slate-900/90 border border-slate-800 rounded space-y-2">
                   <div className="flex items-center justify-between">
                     <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                       Installed Local VM Models (Quick Select Tutor Model)
                     </span>
                     <span className="text-[10px] text-slate-500 font-mono">student@llm:~$ ollama list</span>
                   </div>
                   <div className="flex flex-wrap gap-1.5">
                     {[
                       { name: 'qwen3-coder:30b', desc: '18 GB • Best Coding/Linux Tutor' },
                       { name: 'qwen3.8:27b', desc: '17 GB • General Reasoning' },
                       { name: 'llama3.1:8b', desc: '4.9 GB • Fast Instruct / Guard' },
                       { name: 'deepseek-r1:latest', desc: '5.2 GB • Chain-of-Thought (<think> stripped)' },
                       { name: 'qwen2.5-coder:7b', desc: 'Protocol V5 Default' }
                     ].map((m) => (
                       <button
                         key={m.name}
                         type="button"
                         onClick={() => setLocalConfig({ ...localConfig, ollamaModel: m.name, tutorModel: m.name })}
                         className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-all flex items-center gap-1.5 ${
                           localConfig.ollamaModel === m.name
                             ? 'bg-orange-500/20 border-orange-500 text-orange-300 font-bold'
                             : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                         }`}
                         title={m.desc}
                       >
                         <span>{m.name}</span>
                         <span className="text-[9px] text-slate-500 font-sans">({m.desc.split('•')[0].trim()})</span>
                       </button>
                     ))}
                   </div>
                   <div className="flex items-center gap-2 pt-1">
                     <span className="text-[10px] text-slate-400">Guard Model Quick Select:</span>
                     {['llama-guard3:1b', 'llama3.1:8b'].map((gm) => (
                       <button
                         key={gm}
                         type="button"
                         onClick={() => setLocalConfig({ ...localConfig, llamaGuardModel: gm })}
                         className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                           (localConfig.llamaGuardModel || 'llama-guard3:1b') === gm
                             ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                             : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                         }`}
                       >
                         {gm}
                       </button>
                     ))}
                   </div>
                 </div>

                 <div className="text-[10px] text-orange-300/60 bg-orange-900/10 p-3 rounded border border-orange-900/20 leading-relaxed font-mono">
                    <p className="font-bold mb-1">Host-run Ollama (loopback only):</p>
                    <code>OLLAMA_HOST=127.0.0.1:2004 OLLAMA_NUM_PARALLEL=16 ollama serve</code>
                 </div>
              </div>
            )}

            {activeTab === 'openai' && (
              <div className="space-y-4">
                <label className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">OpenAI Config</label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={localConfig.openaiKey || ''}
                  onChange={(e) => setLocalConfig({ ...localConfig, openaiKey: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm focus:border-emerald-500 outline-none"
                />
                <input
                  type="text"
                  placeholder="Model (e.g. gpt-4o)"
                  value={localConfig.openaiModel || 'gpt-4o'}
                  onChange={(e) => setLocalConfig({ ...localConfig, openaiModel: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm focus:border-emerald-500 outline-none"
                />
              </div>
            )}

            {activeTab === 'anthropic' && (
              <div className="space-y-4">
                <label className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Anthropic Config</label>
                <input
                  type="password"
                  placeholder="sk-ant-..."
                  value={localConfig.anthropicKey || ''}
                  onChange={(e) => setLocalConfig({ ...localConfig, anthropicKey: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm focus:border-purple-500 outline-none"
                />
                <input
                  type="text"
                  placeholder="Model (e.g. claude-3-5-sonnet...)"
                  value={localConfig.anthropicModel || 'claude-3-5-sonnet-20240620'}
                  onChange={(e) => setLocalConfig({ ...localConfig, anthropicModel: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm focus:border-purple-500 outline-none"
                />
                <p className="text-[10px] text-red-400">Note: Anthropic API typically blocks browser requests (CORS) unless you use a proxy.</p>
              </div>
            )}

            {activeTab === 'custom' && (
               <div className="space-y-4">
                 <div className="flex justify-between items-center">
                   <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">OpenAI Compatible Endpoint</label>
                   <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-1 rounded">Compatible with: LM Studio, LocalAI, vLLM, Groq, Perplexity</span>
                 </div>
                 
                 <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Base URL</label>
                    <input
                      type="text"
                      placeholder="http://localhost:2005/v1/chat/completions"
                      value={localConfig.openaiUrl || ''}
                      onChange={(e) => setLocalConfig({ ...localConfig, openaiUrl: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm focus:border-white outline-none font-mono"
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-[10px] text-slate-400 mb-1">API Key</label>
                       <input
                        type="password"
                        placeholder="Optional for local"
                        value={localConfig.openaiKey || ''}
                        onChange={(e) => setLocalConfig({ ...localConfig, openaiKey: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm focus:border-white outline-none"
                      />
                    </div>
                    <div>
                       <label className="block text-[10px] text-slate-400 mb-1">Model ID</label>
                       <input
                        type="text"
                        placeholder="local-model"
                        value={localConfig.openaiModel || ''}
                        onChange={(e) => setLocalConfig({ ...localConfig, openaiModel: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm focus:border-white outline-none"
                      />
                    </div>
                 </div>
               </div>
            )}

            {/* RESEARCH & FORMAL RUN LOCKER TAB */}
            {activeTab === 'research' && (
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="text-xs font-semibold text-rose-400 uppercase tracking-wider block">
                      Formal Evaluation Run Management & Version Freeze
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Lock application configuration and seed to prevent mid-evaluation drift.
                    </p>
                  </div>
                  {activeRun && activeRun.isLocked ? (
                    <span className="flex items-center gap-1 text-xs bg-red-950 text-red-300 border border-red-800 px-2.5 py-1 rounded font-bold">
                      <Lock size={12} /> RUN LOCKED: {activeRun.runId}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded">
                      No active locked run
                    </span>
                  )}
                </div>

                {/* Application Version & Research Readiness */}
                <div className="p-3.5 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 font-mono font-bold text-xs">
                      v1.0.0
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">Application Version: 1.0.0</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 font-mono">
                          NOT READY FOR COLLECTION
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Ground-truth verification, sequestered-case workflows, and governance transitions are not implemented.
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-500 block">Protocol Version</span>
                    <span className="text-xs font-mono text-slate-300">V5.0.0</span>
                  </div>
                </div>

                <div className="p-4 bg-amber-950/30 rounded-lg border border-amber-900/50 text-xs text-amber-200">
                  Run creation, locking, and unlocking are disabled because their server-authoritative governance workflow is not implemented. Do not collect participant data with this build.
                </div>

                {/* Model Separation: Tutor vs Evaluator */}
                <div className="p-4 bg-slate-900 rounded-lg border border-slate-800 space-y-3">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Independent Model Pipeline Configuration
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Tutor Instructional Model</label>
                      <input
                        type="text"
                        value={localConfig.tutorModel || localConfig.ollamaModel || 'qwen3-coder:30b'}
                        onChange={(e) => setLocalConfig({ ...localConfig, tutorModel: e.target.value, ollamaModel: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Shadow Evaluator Model (CEW)</label>
                      <input
                        type="text"
                        value={localConfig.evaluatorModel || localConfig.ollamaModel || 'qwen3-coder:30b'}
                        onChange={(e) => setLocalConfig({ ...localConfig, evaluatorModel: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={localConfig.sameModelAsTutor ?? true}
                      onChange={(e) => setLocalConfig({ ...localConfig, sameModelAsTutor: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-950 text-rose-500"
                    />
                    <span>Flag in Telemetry if Same Model Powers Both Tutor and CEW Evaluator</span>
                  </label>
                </div>

                {/* Version Freeze & Reproducibility Matrix */}
                <div className="p-4 bg-slate-900 rounded-lg border border-slate-800 space-y-2 text-xs font-mono">
                  <span className="text-slate-400 block font-sans font-bold uppercase text-[10px]">
                    System Frozen Artifact Manifest (v2.0.0)
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div>• Application Version: <span className="text-rose-400">2.0.0</span></div>
                    <div>• Prompt Template Version: <span className="text-rose-400">2.0.0</span></div>
                    <div>• Guardrail Policy Version: <span className="text-rose-400">2.0.0</span></div>
                    <div>• CEW Rubric Version: <span className="text-rose-400">2.0.0</span></div>
                    <div>• Task Specification Version: <span className="text-rose-400">2.0.0</span></div>
                    <div>• Telemetry Schema Version: <span className="text-rose-400">2.0.0</span></div>
                  </div>
                </div>

                {/* Official Research Export Package */}
                <div className="p-4 bg-slate-900 rounded-lg border border-slate-800 space-y-3">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Export Analysis-Ready Research Package (.ZIP)
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Bundles events.csv, sessions.csv, tasks.csv, test_cases.csv, expert_reviews.csv, cew_submissions.csv, cew_scores.csv, guardrail_events.csv, telemetry_validation.csv, research_configuration.json, data_dictionary.md, and export_manifest.json with SHA-256 hashes.
                  </p>
                  <div className="flex items-center justify-between gap-4 pt-1">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportStripFreeText}
                        onChange={(e) => setExportStripFreeText(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-950 text-rose-500"
                      />
                      <span>Sanitize Free-Text Entries (Strip open student prompts for public release)</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleDownloadResearchPackage}
                      disabled={isExporting}
                      className="px-4 py-2 bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white font-bold text-xs rounded shadow flex items-center gap-2"
                    >
                      <Download size={14} />
                      {isExporting ? 'Packaging ZIP...' : 'Download Research ZIP'}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

        <div className="p-5 border-t border-slate-800 bg-slate-950">
          <button
            onClick={handleSave}
            className="w-full bg-gradient-to-r from-slate-200 to-white hover:to-slate-100 text-slate-900 font-bold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
            <Save size={18} /> 
            {(activeTab === 'security' || activeTab === 'users' || activeTab === 'levels') ? 'Close & Save' : 'Connect & Save'}
          </button>
        </div>
      </div>
    </div>
  );
};