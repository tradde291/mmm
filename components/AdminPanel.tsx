import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Book, ArrowLeft, CheckCircle } from 'lucide-react';
import { uploadTextbook, getAllTextbooks, deleteTextbook } from '../services/db';
import { Textbook } from '../types';

interface AdminPanelProps {
  onBack: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const [selectedClass, setSelectedClass] = useState('1');
  const [subject, setSubject] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [books, setBooks] = useState<Textbook[]>([]);
  const [msg, setMsg] = useState('');

  const classes = Array.from({ length: 10 }, (_, i) => (i + 1).toString());

  const loadBooks = async () => {
    try {
      const data = await getAllTextbooks();
      setBooks(data.sort((a, b) => b.uploadedAt - a.uploadedAt));
    } catch (e) {
      console.error("Failed to load books", e);
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !subject) return;

    setIsUploading(true);
    try {
      await uploadTextbook(selectedClass, subject, file);
      setMsg('Book uploaded!');
      setSubject('');
      setFile(null);
      // Reset file input visually
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      await loadBooks();
      setTimeout(() => setMsg(''), 3000);
    } catch (error) {
      console.error(error);
      setMsg('Failed to upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this book?')) {
      await deleteTextbook(id);
      loadBooks();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 pb-20">
      <div className="max-w-5xl mx-auto">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 mb-6 font-medium text-sm md:text-base"
        >
          <ArrowLeft size={20} />
          Back
        </button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          
          {/* Upload Form */}
          <div className="md:col-span-1">
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-lg border border-slate-200 sticky top-4">
              <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-4 md:mb-6 flex items-center gap-2">
                <Upload className="text-indigo-600" />
                Upload
              </h2>

              <form onSubmit={handleUpload} className="space-y-3 md:space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
                  <select 
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full p-2 md:p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  >
                    {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                  <input 
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Math"
                    className="w-full p-2 md:p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">PDF</label>
                  <input 
                    id="file-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="w-full text-xs md:text-sm text-slate-500 file:mr-2 md:file:mr-4 file:py-2 file:px-3 md:file:px-4 file:rounded-full file:border-0 file:text-xs md:file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isUploading || !file}
                  className="w-full bg-indigo-600 text-white py-2 md:py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-sm md:text-base"
                >
                  {isUploading ? 'Uploading...' : 'Save Book'}
                </button>

                {msg && (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 p-2 md:p-3 rounded-lg text-xs md:text-sm">
                    <CheckCircle size={16} />
                    {msg}
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Book List */}
          <div className="md:col-span-2">
            <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-4 md:mb-6">Inventory</h2>
            
            {books.length === 0 ? (
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-500 text-sm">
                No books uploaded.
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {books.map((book) => (
                  <div key={book.id} className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-colors">
                    <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-50 rounded-lg flex shrink-0 items-center justify-center text-indigo-600 font-bold text-base md:text-lg">
                        {book.className}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-800 text-sm md:text-base truncate">{book.subject}</h3>
                        <p className="text-xs md:text-sm text-slate-500 truncate">Class {book.className} • {(book.file.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleDelete(book.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      title="Delete"
                    >
                      <Trash2 size={18} className="md:w-5 md:h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};