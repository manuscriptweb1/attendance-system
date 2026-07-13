import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import { FiCheckCircle, FiMail, FiPhone, FiMapPin, FiSend } from 'react-icons/fi';

const ContactPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name:'', email:'', subject:'', message:'' });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    document.title = 'Contact Us - AttendNest | Get Support';
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute('content', "Contact AttendNest support. Get help with employee attendance tracking, GPS validation, technical issues, or general inquiries.");
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setFormData({ name:'', email:'', subject:'', message:'' }); }, 3000);
  };

  const contacts = [
    { icon: FiMail,   color: 'bg-[#2563EB]/10 text-[#2563EB]', title: 'Email Support',   value: 'support@attendancesystem.com', sub: "We'll respond within 24 hours" },
    { icon: FiPhone,  color: 'bg-emerald-50 text-emerald-600',  title: 'Phone Support',   value: '+1 (555) 123-4567',            sub: 'Mon-Fri, 9:00 AM – 6:00 PM'  },
    { icon: FiMapPin, color: 'bg-purple-50 text-purple-600',    title: 'Office Location', value: '123 Business Avenue',         sub: 'Tech District, City 12345'    },
  ];

  const hours = [
    { title:'Email Support', avail:'24/7 Available',       sub:'Response within 24 hours' },
    { title:'Phone Support', avail:'Monday – Friday',      sub:'9:00 AM – 6:00 PM EST'    },
    { title:'Live Chat',     avail:'Monday – Friday',      sub:'9:00 AM – 6:00 PM EST'    },
  ];

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#F8FAFC] to-[#EFF6FF]">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#0F172A] mb-4">Get in <span className="text-[#2563EB]">Touch</span></h1>
          <p className="text-lg text-[#475569]">Have questions or need support? We're here to help you with your attendance management needs</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Form */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-8 shadow-clay">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">Send us a Message</h2>
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4"><FiCheckCircle size={30} /></div>
                <h3 className="text-lg font-bold text-[#0F172A] mb-2">Message Sent!</h3>
                <p className="text-sm text-[#475569]">Thank you for contacting us. We'll get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {[['name','Your Name','text','John Doe'],['email','Email Address','email','john@example.com'],['subject','Subject','text','How can we help you?']].map(([name,label,type,ph]) => (
                  <div key={name}>
                    <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2">{label}</label>
                    <input type={type} name={name} value={formData[name]} onChange={handleChange} required placeholder={ph} className="emp-input" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2">Message</label>
                  <textarea name="message" value={formData.message} onChange={handleChange} required rows="5" placeholder="Tell us more about your inquiry..." className="emp-input resize-none" />
                </div>
                <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#2563EB] text-[#0F172A] font-bold rounded-xl hover:bg-blue-700 shadow-[0_4px_16px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 transition-all">
                  <FiSend size={15} /> Send Message
                </button>
              </form>
            )}
          </div>

          {/* Info */}
          <div>
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">Contact Information</h2>
            <div className="space-y-4 mb-8">
              {contacts.map(({ icon: Icon, color, title, value, sub }) => (
                <div key={title} className="flex items-start gap-4 p-5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}><Icon size={18} /></div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">{title}</h3>
                    <p className="text-sm text-[#475569] mt-0.5">{value}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Quick links */}
            <div className="bg-[#2563EB]/8 border border-[#2563EB]/15 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-[#0F172A] mb-4">Quick Links</h3>
              <ul className="space-y-2.5">
                {[['Help Center & Documentation','/support'],['Frequently Asked Questions','/faq'],['Employee Login','/employee/login'],['Reset Password','/forgot-password']].map(([label,path]) => (
                  <li key={path}><button onClick={() => navigate(path)} className="flex items-center gap-2 text-sm text-[#2563EB] hover:text-blue-700 font-semibold transition-colors"><FiCheckCircle size={14} />{label}</button></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Support hours */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-extrabold text-[#0F172A] mb-8 text-center">Support Hours</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {hours.map(({ title, avail, sub }) => (
              <div key={title} className="bg-white border border-[#E2E8F0] rounded-2xl p-6 text-center shadow-clay">
                <h3 className="text-sm font-bold text-[#0F172A] mb-2">{title}</h3>
                <p className="text-[#2563EB] font-semibold text-sm">{avail}</p>
                <p className="text-xs text-[#64748B] mt-1">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};
export default ContactPage;
