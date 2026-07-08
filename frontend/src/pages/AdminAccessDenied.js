import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiShieldOff, FiArrowLeft } from 'react-icons/fi';

const AdminAccessDenied = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-admin-bg flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
        <FiShieldOff className="w-12 h-12 text-red-600 dark:text-red-400" />
      </div>
      
      <h1 className="text-3xl font-bold text-admin-text mb-4">
        Access Denied
      </h1>
      
      <p className="text-admin-secondary max-w-md mb-8">
        You do not have permission to view this page. If you believe this is a mistake, please contact a Super Admin.
      </p>
      
      <button
        onClick={() => navigate('/admin/dashboard')}
        className="flex items-center gap-2 px-6 py-3 bg-admin-accent hover:bg-admin-accent2 text-white rounded-xl font-medium transition-colors"
      >
        <FiArrowLeft size={18} />
        Return to Dashboard
      </button>
    </div>
  );
};

export default AdminAccessDenied;
