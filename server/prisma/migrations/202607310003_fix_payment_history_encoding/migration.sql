UPDATE `PaymentStatusHistory`
SET `note` = 'Khởi tạo lịch sử từ trạng thái thanh toán hiện tại'
WHERE `note` = 'Kh?i t?o l?ch s? t? tr?ng th?i thanh to?n hi?n t?i';

UPDATE `PaymentStatusHistory`
SET `note` = REPLACE(`note`, 'Ghi nh?n thanh to?n', 'Ghi nhận thanh toán')
WHERE `note` LIKE '%Ghi nh?n thanh to?n%';

UPDATE `PaymentStatusHistory`
SET `note` = REPLACE(`note`, 'M? tham chi?u:', 'Mã tham chiếu:')
WHERE `note` LIKE 'M? tham chi?u:%';

UPDATE `PaymentStatusHistory`
SET `note` = REPLACE(`note`, 'Ho?n ti?n:', 'Hoàn tiền:')
WHERE `note` LIKE 'Ho?n ti?n:%';
