'use strict';

const crypto = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const templates = [
      {
        name: 'work_order_technician_assigned',
        triggerEvent: 'work_order_technician_assigned',
        channel: 'email',
        subject: 'Your Technician Appointment: {{technician_name}} will visit on {{scheduled_date}}',
        body: 'Hello {{customer_name}},\n\nYour service appointment for Work Order #{{work_order_number}} has been scheduled.\n\nTechnician: {{technician_name}}\n{{technician_phone_line}}Visit Window: {{scheduled_date}} ({{scheduled_time_window}})\nAddress: {{service_address}}\n\nNeed to make changes? Contact us at {{company_support_phone}} or reply to this email.\n\nBest regards,\n{{company_name}}',
        isActive: true,
      },
      {
        name: 'work_order_visit_updated',
        triggerEvent: 'work_order_visit_updated',
        channel: 'email',
        subject: 'Update: Your Service Appointment for Work Order #{{work_order_number}}',
        body: 'Hello {{customer_name}},\n\nThere is an update to your service appointment for Work Order #{{work_order_number}}.\n\nTechnician: {{technician_name}}\n{{technician_phone_line}}Visit Window: {{scheduled_date}} ({{scheduled_time_window}})\nAddress: {{service_address}}\n\nIf you have questions, please reach out to {{company_support_phone}}.\n\nBest regards,\n{{company_name}}',
        isActive: true,
      },
      {
        name: 'work_order_visit_cancelled',
        triggerEvent: 'work_order_visit_cancelled',
        channel: 'email',
        subject: 'Cancelled: Your Service Appointment for Work Order #{{work_order_number}}',
        body: 'Hello {{customer_name}},\n\nYour service appointment previously scheduled for {{scheduled_date}} for Work Order #{{work_order_number}} has been cancelled.\n\nIf you would like to reschedule, please contact us at {{company_support_phone}} or reply to this email.\n\nBest regards,\n{{company_name}}',
        isActive: true,
      },
      {
        name: 'work_order_feedback_request',
        triggerEvent: 'work_order_feedback_request',
        channel: 'email',
        subject: 'How did we do? Rate your recent service for Work Order #{{work_order_number}}',
        body: 'Hello {{customer_name}},\n\nYour service request #{{work_order_number}} has been completed. We would love to hear your feedback on the service provided by {{technician_name}}.\n\nPlease rate your experience by clicking one of the links below:\n\n⭐ 1 - Poor: {{rating_link_1}}\n⭐ 2 - Fair: {{rating_link_2}}\n⭐ 3 - Good: {{rating_link_3}}\n⭐ 4 - Very Good: {{rating_link_4}}\n⭐ 5 - Excellent: {{rating_link_5}}\n\nThank you for choosing {{company_name}}!',
        isActive: true,
      },
    ];

    for (const tmpl of templates) {
      const existing = await queryInterface.rawSelect(
        'MessageTemplates',
        {
          where: {
            name: tmpl.name,
            channel: 'email',
          },
        },
        ['id']
      );

      if (!existing) {
        await queryInterface.bulkInsert('MessageTemplates', [
          {
            id: crypto.randomUUID(),
            ...tmpl,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);
      }
    }
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('MessageTemplates', {
      name: [
        'work_order_technician_assigned',
        'work_order_visit_updated',
        'work_order_visit_cancelled',
        'work_order_feedback_request',
      ],
      channel: 'email',
    });
  },
};
