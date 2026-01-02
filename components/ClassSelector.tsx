import React, { useState, useEffect } from 'react';
import { BookOpen, Book, ArrowLeft, Shield } from 'lucide-react';
import { getTextbooksByClass } from '../services/db';
import { Textbook } from '../types';

interface ClassSelectorProps {
  onFileSelect: (file: File) => void;
  onAdminClick: () => void;
}

export const ClassSelector: React.FC<ClassSelectorProps> = ({ onFileSelect, onAdminClick }) => {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [availableBooks, setAvailableBooks] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(false);

  const classes = Array.from({ length: 10 }, (_, i) => (i + 1).toString());

  useEffect(() => {
    if (selectedClass) {
      setLoading(true);
      getTextbooksByClass(selectedClass)
        .then(books => setAvailableBooks(books))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    } else {
        setAvailableBooks([]);
    }
  }, [selectedClass]);

  const handleBookClick = (book: Textbook) => {
    if (book.file instanceof File) {
        onFileSelect(book.file);
    } else {
        const file = new File([book.file], `${book.subject}.pdf`, { type: 'application/pdf' });
        onFileSelect(file);
    }
  };

  if (selectedClass) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 md:p-6 pb-20">
        <button 
          onClick={() => setSelectedClass(null)}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-6 md:mb-8 font-medium transition-colors text-sm md:text-base"
        >
          <ArrowLeft size={20} />
          Choose a different class
        </button>

        <div className="text-center mb-8 md:mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Class {selectedClass} Library</h2>
            <p className="text-slate-500 mt-2 text-sm md:text-base">Select a subject to start learning</p>
        </div>

        {loading ? (
             <div className="flex justify-center p-12">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
             </div>
        ) : availableBooks.length === 0 ? (
            <div className="text-center bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-dashed border-slate-300 mx-4">
                <p className="text-slate-500 mb-4">No books available for Class {selectedClass} yet.</p>
                <div className="inline-block bg-yellow-50 text-yellow-800 px-4 py-2 rounded-lg text-sm">
                    Ask your admin to upload books.
                </div>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {availableBooks.map(book => (
                    <button
                        key={book.id}
                        onClick={() => handleBookClick(book)}
                        className="bg-white p-4 md:p-6 rounded-2xl shadow-md border border-slate-100 hover:border-indigo-300 hover:shadow-xl hover:-translate-y-1 transition-all text-left group"
                    >
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-3 md:mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <Book size={20} className="md:w-6 md:h-6" />
                        </div>
                        <h3 className="font-bold text-base md:text-lg text-slate-800 group-hover:text-indigo-600 transition-colors">{book.subject}</h3>
                        <p className="text-slate-400 text-xs md:text-sm mt-1">PDF Textbook</p>
                    </button>
                ))}
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 relative">
      {/* Admin Link (Subtle) */}
      <div className="absolute top-0 right-4 md:right-6">
        <button 
            onClick={onAdminClick}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-600 text-xs md:text-sm px-3 py-1 rounded-full hover:bg-slate-100 transition-colors"
        >
            <Shield size={14} />
            Admin
        </button>
      </div>

      <div className="text-center mb-8 md:mb-12 mt-8 md:mt-8">
        <h1 className="text-2xl md:text-4xl font-bold text-slate-800 mb-2 md:mb-3">BanglaGenius Tutor</h1>
        <p className="text-base md:text-lg text-slate-600">Your AI-powered companion for better grades.</p>
        <p className="text-xs md:text-sm text-slate-500 mt-2">Select your class to view available books.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-4 md:p-8 border border-slate-100">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          {classes.map((num) => (
            <button
              key={num}
              onClick={() => setSelectedClass(num)}
              className="flex flex-col items-center justify-center p-3 md:p-4 rounded-xl bg-slate-50 hover:bg-indigo-50 transition-colors border border-slate-100 hover:border-indigo-200 group"
            >
              <div className="bg-white p-2 md:p-3 rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform">
                <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
              </div>
              <span className="font-semibold text-sm md:text-base text-slate-700 group-hover:text-indigo-700">Class {num}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};