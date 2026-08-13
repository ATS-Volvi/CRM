import React, { useMemo } from 'react';
import { X, MessageCircle, Mail, Phone, Calendar, User } from 'lucide-react';

interface RelatedInquiriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
}

export function RelatedInquiriesModal({ isOpen, onClose, lead }: RelatedInquiriesModalProps) {
  if (!isOpen || !lead) return null;

  // Build combined inquiries list: [Primary Lead, ...Secondary Contacts]
  const inquiries = useMemo(() => {
    const list = [];
    
    // 1. Primary Lead
    list.push({
      id: lead.id || 'primary',
      isPrimary: true,
      name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
      email: lead.email,
      phone: lead.phone,
      sourceChannel: lead.source || 'Website',
      createdAt: lead.createdAt,
      message: lead.rawPayload?.message || 'Initial inquiry (no message attached)'
    });

    // 2. Secondary Contacts
    if (lead.contacts && Array.isArray(lead.contacts)) {
      lead.contacts.forEach((c: any) => {
        list.push({
          id: c.id,
          isPrimary: false,
          name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
          email: c.email,
          phone: c.phone,
          sourceChannel: c.sourceChannel || 'Website',
          createdAt: c.createdAt,
          message: c.message || 'Secondary inquiry (no message attached)'
        });
      });
    }

    // Sort by newest first
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return list;
  }, [lead]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border flex justify-between items-center bg-muted/20">
          <div>
            <h2 className="text-lg font-bold text-foreground">Related Inquiries</h2>
            <p className="text-xs text-muted-foreground mt-0.5">All contacts and requests from {lead.company || 'this company'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 bg-background">
          <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {inquiries.map((inquiry, idx) => (
              <div key={inquiry.id} className="relative flex items-start gap-4 z-10">
                
                {/* Timeline Dot */}
                <div className="flex flex-col items-center gap-1 min-w-[40px]">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm border-2 border-background ${inquiry.isPrimary ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    <User className="w-5 h-5" />
                  </div>
                  {idx !== inquiries.length - 1 && (
                    <div className="w-0.5 h-full bg-border mt-1"></div>
                  )}
                </div>

                {/* Card */}
                <div className="flex-1 bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative mt-1">
                  {/* Decorative Arrow */}
                  <div className="absolute top-4 -left-2 w-4 h-4 bg-card border-l border-t border-border rotate-45 transform"></div>
                  
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                        {inquiry.name}
                        {inquiry.isPrimary && (
                          <span className="text-[9px] uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded font-black">Primary</span>
                        )}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        {inquiry.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {inquiry.email}</span>}
                        {inquiry.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {inquiry.phone}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 bg-muted/50 border border-border px-2 py-1 rounded text-[10px] font-bold text-foreground capitalize">
                        <MessageCircle className="w-3 h-3 text-primary" /> {inquiry.sourceChannel}
                      </span>
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center justify-end gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(inquiry.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-border/50 bg-muted/20 -mx-4 -mb-4 p-4 rounded-b-xl">
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap italic">"{inquiry.message}"</p>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
