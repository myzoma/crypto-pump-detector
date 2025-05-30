const CONFIG = {
    OKX_API: {
        BASE_URL: 'https://www.okx.com/api/v5',
        API_KEY: 'b20c667d-ae40-48a6-93f4-a11a64185068',
        SECRET_KEY: 'BD7C76F71D1A4E01B4C7E1A23B620365',
        PASSPHRASE: '212160Nm$#',
        SANDBOX: false, // تغيير إلى true للاختبار
        RATE_LIMIT: 20 // طلبات في الثانية
    },

    FILTERS: {
        MIN_VOLUME: 1000000,
        EXCLUDED_SYMBOLS: ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FDUSD'],
        MIN_PRICE: 0.0001,
        MAX_COINS: 200, // زيادة عدد العملات للتحليل
        MIN_MARKET_CAP: 10000000 // الحد الأدنى للقيمة السوقية
    },

    // إعدادات كشف أوضاع السوق
    MARKET_REGIME: {
        // فترات التحليل
        SHORT_PERIOD: 7,
        MEDIUM_PERIOD: 21,
        LONG_PERIOD: 50,
        
        // عتبات تحديد حالة السوق
        BULL_THRESHOLD: 0.65, // 65% من العملات في اتجاه صاعد
        BEAR_THRESHOLD: 0.35, // 35% من العملات في اتجاه هابط
        
        // مؤشرات التقلبات
        HIGH_VOLATILITY_THRESHOLD: 0.05, // 5% تقلب يومي
        LOW_VOLATILITY_THRESHOLD: 0.02,  // 2% تقلب يومي
        
        // مؤشرات الحجم
        VOLUME_SURGE_MULTIPLIER: 2.0, // ضعف الحجم العادي
        VOLUME_DRY_MULTIPLIER: 0.5    // نصف الحجم العادي
    },

    // نظام النقاط المتكيف حسب حالة السوق
    SCORING: {
        BULL_MARKET: {
            RSI_POSITIVE: 20,
            MACD_POSITIVE: 20,
            HIGH_LIQUIDITY: 25,
            BUYING_POWER: 25,
            MA_CROSSOVER: 25,
            MOMENTUM: 15,
            VOLUME_BREAKOUT: 20,
            OVERALL_POSITIVE: 15
        },
        BEAR_MARKET: {
            RSI_OVERSOLD: 25,
            SUPPORT_BOUNCE: 30,
            VOLUME_SPIKE: 20,
            DIVERGENCE: 25,
            DEFENSIVE_SIGNALS: 20,
            OVERALL_POSITIVE: 10
        },
        SIDEWAYS_MARKET: {
            RANGE_TRADING: 25,
            OSCILLATOR_SIGNALS: 20,
            SUPPORT_RESISTANCE: 25,
            MEAN_REVERSION: 20,
            BREAKOUT_POTENTIAL: 15,
            OVERALL_POSITIVE: 10
        },
        VOLATILE_MARKET: {
            VOLATILITY_BREAKOUT: 30,
            MOMENTUM_SURGE: 25,
            VOLUME_CONFIRMATION: 20,
            TREND_STRENGTH: 20,
            RISK_ADJUSTED: -10 // خصم للمخاطر العالية
        }
    },

    // إعدادات إدارة المخاطر المتكيفة
    RISK_MANAGEMENT: {
        BULL_MARKET: {
            MAX_POSITION_SIZE: 0.05, // 5% من المحفظة
            STOP_LOSS_PERCENTAGE: 0.08, // 8%
            TAKE_PROFIT_RATIO: 3, // 1:3 مخاطرة:ربح
            MAX_CONCURRENT_POSITIONS: 10
        },
        BEAR_MARKET: {
            MAX_POSITION_SIZE: 0.02, // 2% من المحفظة
            STOP_LOSS_PERCENTAGE: 0.05, // 5%
            TAKE_PROFIT_RATIO: 2, // 1:2 مخاطرة:ربح
            MAX_CONCURRENT_POSITIONS: 5
        },
        SIDEWAYS_MARKET: {
            MAX_POSITION_SIZE: 0.03, // 3% من المحفظة
            STOP_LOSS_PERCENTAGE: 0.06, // 6%
            TAKE_PROFIT_RATIO: 2.5, // 1:2.5 مخاطرة:ربح
            MAX_CONCURRENT_POSITIONS: 7
        },
        VOLATILE_MARKET: {
            MAX_POSITION_SIZE: 0.015, // 1.5% من المحفظة
            STOP_LOSS_PERCENTAGE: 0.04, // 4%
            TAKE_PROFIT_RATIO: 4, // 1:4 مخاطرة:ربح
            MAX_CONCURRENT_POSITIONS: 3
        }
    },

    // إعدادات التنبيهات
    ALERTS: {
        TELEGRAM_BOT_TOKEN: '', // ضع توكن البوت
        CHAT_ID: '', // معرف المحادثة
        ENABLE_NOTIFICATIONS: true,
        ALERT_THRESHOLDS: {
            HIGH_SCORE: 85,
            VOLUME_SPIKE: 5.0, // 5 أضعاف الحجم العادي
            PRICE_BREAKOUT: 0.1 // 10% كسر للمقاومة
        }
    },

    // إعدادات التحديث
    UPDATE_INTERVALS: {
        FAST_UPDATE: 60000,    // دقيقة واحدة للبيانات السريعة
        NORMAL_UPDATE: 300000, // 5 دقائق للتحليل العادي
        SLOW_UPDATE: 900000    // 15 دقيقة للتحليل العميق
    }
};
