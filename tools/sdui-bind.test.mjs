/**
 * Test cho binding engine của SDUI.
 * Chạy:  npm test   (ở thư mục gốc)
 *
 * Import bản web (dashboard/src/lib/bind.js) vì nó là JS thuần chạy được thẳng trong Node.
 * Logic giống hệt mobile/src/sdui/bind.ts — ở dự án thật hãy tách thành package dùng chung.
 */
import { bind, truthy, getPath } from '../dashboard/src/lib/bind.js';
let pass=0, fail=0;
const eq=(name,a,b)=>{const ok=JSON.stringify(a)===JSON.stringify(b);ok?pass++:fail++;console.log(`${ok?'✓':'✗'} ${name}${ok?'':`  got=${JSON.stringify(a)} want=${JSON.stringify(b)}`}`);};

const ctx = { state:{ email:'a@b.c', loading:false, total:12450000, home:{ items:[1,2] }, amount:-65000 }, user:{ name:'Tùng' }, svc:{ label:'Ví' } };

eq('giữ nguyên kiểu number', bind('{{state.total}}', ctx), 12450000);
eq('giữ nguyên kiểu boolean', bind('{{state.loading}}', ctx), false);
eq('nội suy chuỗi', bind('Chào {{user.name}}!', ctx), 'Chào Tùng!');
eq('nhiều binding', bind('{{user.name}} - {{svc.label}}', ctx), 'Tùng - Ví');
eq('filter currency', bind('{{state.total | currency}}', ctx), new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(12450000));
eq('filter signedCurrency âm', bind('{{state.amount | signedCurrency}}', ctx).startsWith('-'), true);
eq('path không tồn tại -> rỗng', bind('x{{state.nope.deep}}y', ctx), 'xy');
eq('object đệ quy', bind({a:'{{user.name}}', b:[{c:'{{state.total}}'}]}, ctx), {a:'Tùng', b:[{c:12450000}]});
eq('if truthy chuỗi rỗng', truthy('state.error', ctx), false);
eq('if phủ định', truthy('!state.loading', ctx), true);
eq('if mảng rỗng', truthy('state.missing', ctx), false);
eq('if mảng có phần tử', truthy('state.home.items', ctx), true);
eq('if undefined = luôn render', truthy(undefined, ctx), true);
eq('getPath lồng sâu', getPath(ctx,'state.home.items.1'), 2);
eq('không có {{}} trả nguyên', bind('text thường', ctx), 'text thường');
eq('số nguyên không đụng tới', bind(42, ctx), 42);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
