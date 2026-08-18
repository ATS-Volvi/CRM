-- Manual SQL Backup via psql COPY - Mon Aug 17 16:11:14 IST 2026
-- USERS
ERROR:  relation "Users" does not exist
-- DEALS
ERROR:  relation "Deals" does not exist
-- PURCHASEORDERS
ERROR:  relation "PurchaseOrders" does not exist
-- LEADS COUNT CHECK
ERROR:  relation "Leads" does not exist
LINE 1: SELECT COUNT(*) FROM "Leads";
                             ^
ERROR:  relation "Users" does not exist
LINE 1: SELECT COUNT(*) FROM "Users";
                             ^
ERROR:  relation "Deals" does not exist
LINE 1: SELECT COUNT(*) FROM "Deals";
                             ^
ERROR:  relation "PurchaseOrders" does not exist
LINE 1: SELECT COUNT(*) FROM "PurchaseOrders";
                             ^
