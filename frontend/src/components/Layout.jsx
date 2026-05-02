import React from 'react';
import Navbar from './Navbar';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8 max-w-5xl">
        {children}
      </main>
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-slate-500 text-sm">
        Sistema de Voto Electrónico Sindical &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
