import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// استرجاع متغيرات البيئة من Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// المفتاح السري المخصص لقفل قطاعات البطاقة (Custom Sector Key)
// يتم جلبه من إعدادات المشروع في Supabase أو استخدام قيمة افتراضية
const NFC_CUSTOM_KEY_STR = Deno.env.get('NFC_CUSTOM_KEY') || "1A,2B,3C,4D,5E,6F";
const NFC_CUSTOM_KEY = NFC_CUSTOM_KEY_STR.split(',').map(h => parseInt(h.trim(), 16));

serve(async (req: Request) => {
  // السماح بطلبات CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const { mode, uid, token, targetScoutId } = await req.json();

    if (!mode || !uid) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // إنشاء عميل Supabase بصلاحيات الـ Service Role لتجاوز الـ RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (mode) {
      // ----------------------------------------------------
      // وضع التحضير (Attendance)
      // ----------------------------------------------------
      case 'attendance': {
        if (!token) return new Response(JSON.stringify({ error: 'Token missing' }), { status: 400 });

        // 1. جلب بيانات ربط البطاقة
        const { data: tagData, error: tagError } = await supabase
          .from('scout_tags')
          .select('*')
          .eq('uid', uid)
          .single();

        if (tagError || !tagData) {
          console.warn(`[SECURITY] Unregistered tag scanned: ${uid}`);
          return new Response(JSON.stringify({ error: 'Tag not registered' }), { status: 403 });
        }

        // 2. مطابقة الرمز السري (Token)
        if (tagData.secure_token !== token) {
          console.error(`[SECURITY] Token mismatch for UID: ${uid}`);
          return new Response(JSON.stringify({ error: 'Invalid Token Signature' }), { status: 403 });
        }

        // 3. تسجيل الحضور في الجدول الفعلي للمشروع
        const todayAr = new Date().toLocaleDateString('ar-EG');
        const { error: logError } = await supabase
          .from('attendance')
          .insert([{ 
            scout_id: tagData.scout_id, 
            date: todayAr 
          }]);

        if (logError) throw logError;

        return new Response(JSON.stringify({ success: true, message: 'Attendance recorded' }), { 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      // ----------------------------------------------------
      // وضع البرمجة (Program)
      // ----------------------------------------------------
      case 'program': {
        if (!targetScoutId) return new Response(JSON.stringify({ error: 'Missing targetScoutId' }), { status: 400 });

        // توليد رمز عشوائي جديد (16 بايت)
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        const newToken = Array.from(array).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');

        // تحديث أو إنشاء ربط البطاقة بالكشاف
        const { error: upsertError } = await supabase
          .from('scout_tags')
          .upsert({ 
            uid, 
            secure_token: newToken, 
            scout_id: targetScoutId 
          });

        if (upsertError) throw upsertError;

        // إرجاع التوكن والمفتاح للجهاز ليقوم بعملية القفل الفعلي
        return new Response(JSON.stringify({ 
          success: true, 
          token: newToken, 
          customKey: NFC_CUSTOM_KEY 
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      // ----------------------------------------------------
      // وضع المسح (Wipe)
      // ----------------------------------------------------
      case 'wipe': {
        await supabase.from('scout_tags').delete().eq('uid', uid);
        
        return new Response(JSON.stringify({ 
          success: true, 
          customKey: NFC_CUSTOM_KEY 
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid mode' }), { status: 400 });
    }
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
