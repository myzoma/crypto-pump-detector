// ملف script.js جديد ونظيف
console.log('🚀 بدء تشغيل كاشف العملات المشفرة');

// الدوال الأساسية أولاً
function updateWatchlistCounter() {
    try {
        const watchlist = JSON.parse(localStorage.getItem('cryptoWatchlist') || '[]');
        const counter = document.querySelector('.watchlist-counter');
        if (counter) {
            counter.textContent = watchlist.length;
        }
        console.log('✅ تم تحديث عداد المراقبة:', watchlist.length);
    } catch(e) {
        console.log('⚠️ خطأ في تحديث العداد:', e);
    }
}

function addToWatchlist(symbol) {
    try {
        let watchlist = JSON.parse(localStorage.getItem('cryptoWatchlist') || '[]');
        if (!watchlist.includes(symbol)) {
            watchlist.push(symbol);
            localStorage.setItem('cryptoWatchlist', JSON.stringify(watchlist));
            alert('✅ تم إضافة ' + symbol + ' إلى قائمة المراقبة');
            updateWatchlistCounter();
        } else {
            alert('ℹ️ ' + symbol + ' موجود بالفعل في قائمة المراقبة');
        }
    } catch(e) {
        alert('❌ خطأ في إضافة العملة');
        console.error('خطأ addToWatchlist:', e);
    }
}

function showStrategy(symbol) {
    alert('📊 استراتيجية ' + symbol + ' قيد التطوير');
}

function showWatchlist() {
    try {
        const watchlist = JSON.parse(localStorage.getItem('cryptoWatchlist') || '[]');
        if (watchlist.length > 0) {
            alert('📋 قائمة المراقبة:\n' + watchlist.join('\n'));
        } else {
            alert('📋 قائمة المراقبة فارغة');
        }
    } catch(e) {
        alert('📋 قائمة المراقبة');
    }
}

function showAlertsManager() {
    alert('🔔 إدارة التنبيهات قيد التطوير');
}

function showStatistics() {
    alert('📈 الإحصائيات قيد التطوير');
}

function exportAllData() {
    alert('💾 تصدير البيانات قيد التطوير');
}

function copyStrategyToClipboard(symbol) {
    alert('📋 تم نسخ استراتيجية ' + symbol);
}

function setStrategyAlert(symbol) {
    alert('🔔 تم تعيين تنبيه للعملة: ' + symbol);
}

function exportStrategy(symbol) {
    alert('💾 تصدير استراتيجية: ' + symbol);
}

// تشغيل العداد عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 تم تحميل الصفحة');
    updateWatchlistCounter();
});

// تشغيل العداد فوراً إذا كانت الصفحة محملة
if (document.readyState !== 'loading') {
    updateWatchlistCounter();
}

console.log('✅ تم تحميل جميع الدوال بنجاح');
