$content = Get-Content 'c:\Users\HP\Desktop\erpvoltrix\erpvoltrix\components\inventory\client-orders-inventory.tsx' -Raw
$lastBrace = $content.LastIndexOf('}')
$content = $content.Substring(0, $lastBrace + 1)
Set-Content 'c:\Users\HP\Desktop\erpvoltrix\erpvoltrix\components\inventory\client-orders-inventory.tsx' -Value $content -NoNewline
