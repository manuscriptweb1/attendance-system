import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { FiUsers, FiLayers, FiUmbrella } from 'react-icons/fi';
import ManageEmployees from './manage/ManageEmployees';
import ManageDepartments from './manage/ManageDepartments';
import ManageHolidays from './manage/ManageHolidays';

const AdminManage = () => {
  const [activeTab, setActiveTab] = useState('employees');

  const tabs = [
    { id: 'employees', label: 'Employees', icon: FiUsers },
    { id: 'departments', label: 'Departments', icon: FiLayers },
    { id: 'holidays', label: 'Holidays', icon: FiUmbrella },
  ];

  return (
    <div className="flex h-screen bg-admin-bg dark-scroll">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll pb-24 relative">
        <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto pt-14 lg:pt-8 animate-fadeIn">
          
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-admin-heading tracking-tight drop-shadow-md">System Management</h1>
            <p className="text-sm text-admin-muted mt-1.5 font-medium">Manage all organizational entities from one central place.</p>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-admin-surface border border-admin-border p-1 rounded-2xl w-full max-w-2xl mb-8">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-[#3B82F6] text-white shadow-glow-blue'
                    : 'text-admin-secondary hover:text-admin-text hover:bg-admin-elevated'
                }`}
              >
                <tab.icon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Active Tab Content */}
          <div className="mt-4">
            {activeTab === 'employees' && <ManageEmployees />}
            {activeTab === 'departments' && <ManageDepartments />}
            {activeTab === 'holidays' && <ManageHolidays />}
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminManage;
