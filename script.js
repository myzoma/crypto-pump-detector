class EnhancedCryptoPumpDetector {
    constructor() {
        this.coins = [];
        this.filteredCoins = [];
        this.currentFilter = 'all';
        this.isLoading = false;
        this.marketRegime = 'neutral';
        this.marketMetrics = {};
        this.historicalData = new Map();
        this.alertSystem = new AlertSystem();
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.initializeMarketAnalysis();
        this.loadData();
        this.setupUpdateIntervals();
    }

    // كشف حالة السوق المتقدم
    async detectMarketRegime() {
        try {
            const marketData = await this.fetchMarketOverview();
            const analysis = this.analyzeMarketConditions(marketData);
            
            this.marketRegime = this.determineMarketRegime(analysis);
            this.marketMetrics = analysis;
            
            this.updateMarketDisplay();
            return this.marketRegime;
        } catch (error) {
            console.error('خطأ في كشف حالة السوق:', error);
            return 'neutral';
        }
    }

    async fetchMarketOverview() {
        // جلب بيانات السوق العامة
        const [tickers, btcData, ethData, totalMarketCap] = await Promise.all([
            this.fetchOKXTickers(),
            this.fetchCandleData([{instId: 'BTC-USDT'}]),
            this.fetchCandleData([{instId: 'ETH-USDT'}]),
            this.fetchMarketCapData()
        ]);

        return {
            tickers,
            btcData: btcData[0]?.candles || [],
            ethData: ethData[0]?.candles || [],
            totalMarketCap
        };
    }

    analyzeMarketConditions(marketData) {
        const { tickers, btcData, ethData } = marketData;
        
        // تحليل الاتجاه العام
        const trendAnalysis = this.analyzeTrendDirection(tickers);
        
        // تحليل التقلبات
        const volatilityAnalysis = this.analyzeVolatility(tickers, btcData);
        
        // تحليل الأحجام
        const volumeAnalysis = this.analyzeVolumeProfile(tickers);
        
        // تحليل قوة السوق
        const strengthAnalysis = this.analyzeMarketStrength(tickers);
        
        // تحليل الارتباط
        const correlationAnalysis = this.analyzeCorrelations(btcData, ethData);

        return {
            trend: trendAnalysis,
            volatility: volatilityAnalysis,
            volume: volumeAnalysis,
            strength: strengthAnalysis,
            correlation: correlationAnalysis,
            timestamp: Date.now()
        };
    }

    analyzeTrendDirection(tickers) {
        const changes24h = tickers.map(t => parseFloat(t.sodUtc8));
        const positiveCount = changes24h.filter(c => c > 0).length;
        const negativeCount = changes24h.filter(c => c < 0).length;
        const neutralCount = changes24h.filter(c => c === 0).length;
        
        const total = tickers.length;
        const bullishRatio = positiveCount / total;
        const bearishRatio = negativeCount / total;
        
        // تحليل قوة الاتجاه
        const avgPositiveChange = changes24h.filter(c => c > 0)
            .reduce((a, b) => a + b, 0) / positiveCount || 0;
        const avgNegativeChange = changes24h.filter(c => c < 0)
            .reduce((a, b) => a + b, 0) / negativeCount || 0;

        return {
            bullishRatio,
            bearishRatio,
            neutralRatio: neutralCount / total,
            avgPositiveChange,
            avgNegativeChange,
            trendStrength: Math.abs(bullishRatio - bearishRatio),
            direction: bullishRatio > bearishRatio ? 'bullish' : 'bearish'
        };
    }

    analyzeVolatility(tickers, btcData) {
        // تحليل التقلبات على مستوى السوق
        const volatilities = tickers.map(ticker => {
            const high = parseFloat(ticker.high24h);
            const low = parseFloat(ticker.low24h);
            const close = parseFloat(ticker.last);
            return (high - low) / close;
        });

        const avgVolatility = volatilities.reduce((a, b) => a + b, 0) / volatilities.length;
        const highVolatilityCount = volatilities.filter(v => 
            v > CONFIG.MARKET_REGIME.HIGH_VOLATILITY_THRESHOLD).length;
        
        // تحليل تقلبات البيتكوين
        const btcVolatility = this.calculateBTCVolatility(btcData);

        return {
            avgVolatility,
            highVolatilityRatio: highVolatilityCount / tickers.length,
            btcVolatility,
            regime: this.classifyVolatilityRegime(avgVolatility),
            trend: this.getVolatilityTrend(btcData)
        };
    }

    analyzeVolumeProfile(tickers) {
        const volumes = tickers.map(t => parseFloat(t.vol24h));
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        
        // تحليل توزيع الأحجام
        const volumeDistribution = this.calculateVolumeDistribution(volumes);
        
        // كشف طفرات الحجم
        const volumeSpikes = this.detectVolumeSpikes(tickers);

        return {
            avgVolume,
            distribution: volumeDistribution,
            spikes: volumeSpikes,
            concentration: this.calculateVolumeConcentration(volumes),
            trend: this.getVolumeTrend(volumes)
        };
    }

    analyzeMarketStrength(tickers) {
        // تحليل قوة السوق باستخدام مؤشرات متعددة
        const rsiValues = [];
        const macdValues = [];
        
        tickers.forEach(ticker => {
            // حساب RSI و MACD لكل عملة (مبسط)
            const rsi = this.quickRSI(ticker);
            const macd = this.quickMACD(ticker);
            
            if (rsi) rsiValues.push(rsi);
            if (macd) macdValues.push(macd);
        });

        const avgRSI = rsiValues.reduce((a, b) => a + b, 0) / rsiValues.length;
        const bullishMACD = macdValues.filter(m => m > 0).length / macdValues.length;

        return {
            avgRSI,
            bullishMACD,
            overboughtRatio: rsiValues.filter(r => r > 70).length / rsiValues.length,
            oversoldRatio: rsiValues.filter(r => r < 30).length / rsiValues.length,
            strength: this.calculateOverallStrength(avgRSI, bullishMACD)
        };
    }

       determineMarketRegime(analysis) {
        const { trend, volatility, volume, strength } = analysis;
        
        // منطق تحديد حالة السوق
        if (trend.bullishRatio > CONFIG.MARKET_REGIME.BULL_THRESHOLD && 
            strength.strength > 0.6 && 
            volume.trend === 'increasing') {
            return volatility.regime === 'high' ? 'bull_volatile' : 'bull_stable';
        }
        
        if (trend.bearishRatio > (1 - CONFIG.MARKET_REGIME.BEAR_THRESHOLD) && 
            strength.strength < 0.4) {
            return volatility.regime === 'high' ? 'bear_volatile' : 'bear_stable';
        }
        
        if (volatility.regime === 'high' && trend.trendStrength < 0.2) {
            return 'volatile_sideways';
        }
        
        if (trend.trendStrength < 0.15 && volatility.regime === 'low') {
            return 'sideways_stable';
        }
        
        return 'neutral';
    }

    // تكييف الاستراتيجية حسب حالة السوق
    adaptStrategyToMarket(coin, marketRegime) {
        const baseAnalysis = coin.analysis;
        let adaptedScore = 0;
        let riskLevel = 'medium';
        let strategy = {};

        switch (marketRegime) {
            case 'bull_stable':
                adaptedScore = this.calculateBullMarketScore(baseAnalysis);
                riskLevel = 'low';
                strategy = this.getBullMarketStrategy(coin);
                break;
                
            case 'bull_volatile':
                adaptedScore = this.calculateVolatileBullScore(baseAnalysis);
                riskLevel = 'medium';
                strategy = this.getVolatileBullStrategy(coin);
                break;
                
            case 'bear_stable':
                adaptedScore = this.calculateBearMarketScore(baseAnalysis);
                riskLevel = 'high';
                strategy = this.getBearMarketStrategy(coin);
                break;
                
            case 'bear_volatile':
                adaptedScore = this.calculateVolatileBearScore(baseAnalysis);
                riskLevel = 'very_high';
                strategy = this.getVolatileBearStrategy(coin);
                break;
                
            case 'sideways_stable':
                adaptedScore = this.calculateSidewaysScore(baseAnalysis);
                riskLevel = 'medium';
                strategy = this.getSidewaysStrategy(coin);
                break;
                
            case 'volatile_sideways':
                adaptedScore = this.calculateVolatileSidewaysScore(baseAnalysis);
                riskLevel = 'high';
                strategy = this.getVolatileSidewaysStrategy(coin);
                break;
                
            default:
                adaptedScore = this.calculateScore(baseAnalysis);
                strategy = this.getDefaultStrategy(coin);
        }

        return {
            ...coin,
            adaptedScore,
            riskLevel,
            strategy,
            marketRegime
        };
    }

    // استراتيجيات السوق الصاعد
    getBullMarketStrategy(coin) {
        const analysis = coin.analysis;
        return {
            type: 'bull_market',
            entryConditions: [
                'RSI < 70',
                'MACD > 0',
                'Price > MA20',
                'Volume > Average'
            ],
            entryPrice: coin.price * 0.995, // دخول قريب من السعر الحالي
            stopLoss: coin.price * 0.92,    // وقف خسارة 8%
            targets: [
                coin.price * 1.15, // هدف أول 15%
                coin.price * 1.30, // هدف ثاني 30%
                coin.price * 1.50  // هدف ثالث 50%
            ],
            positionSize: CONFIG.RISK_MANAGEMENT.BULL_MARKET.MAX_POSITION_SIZE,
            timeframe: 'medium_term', // 1-4 أسابيع
            confidence: this.calculateConfidence(analysis, 'bull'),
            notes: 'استراتيجية السوق الصاعد - التركيز على النمو'
        };
    }

    getVolatileBullStrategy(coin) {
        return {
            type: 'volatile_bull',
            entryConditions: [
                'Strong momentum',
                'Volume breakout',
                'RSI 30-65',
                'Support bounce'
            ],
            entryPrice: coin.price * 0.98,  // دخول أكثر حذراً
            stopLoss: coin.price * 0.94,    // وقف خسارة أضيق 6%
            targets: [
                coin.price * 1.12,
                coin.price * 1.25,
                coin.price * 1.40
            ],
            positionSize: CONFIG.RISK_MANAGEMENT.BULL_MARKET.MAX_POSITION_SIZE * 0.7,
            timeframe: 'short_term', // أيام إلى أسبوعين
            confidence: this.calculateConfidence(coin.analysis, 'volatile_bull'),
            notes: 'سوق صاعد متقلب - حذر إضافي مطلوب'
        };
    }

    // استراتيجيات السوق الهابط
    getBearMarketStrategy(coin) {
        return {
            type: 'bear_market',
            entryConditions: [
                'RSI < 30 (Oversold)',
                'Support level bounce',
                'Bullish divergence',
                'Volume spike on bounce'
            ],
            entryPrice: coin.price * 0.985, // دخول حذر
            stopLoss: coin.price * 0.95,    // وقف خسارة ضيق 5%
            targets: [
                coin.price * 1.08,  // أهداف محافظة
                coin.price * 1.15,
                coin.price * 1.22
            ],
            positionSize: CONFIG.RISK_MANAGEMENT.BEAR_MARKET.MAX_POSITION_SIZE,
            timeframe: 'short_term',
            confidence: this.calculateConfidence(coin.analysis, 'bear'),
            notes: 'استراتيجية السوق الهابط - تداول الارتدادات فقط'
        };
    }

    // استراتيجيات السوق الجانبي
    getSidewaysStrategy(coin) {
        const support = coin.analysis.supportResistance.support1;
        const resistance = coin.analysis.supportResistance.resistance1;
        
        return {
            type: 'range_trading',
            entryConditions: [
                'Price near support',
                'RSI 25-40',
                'Bounce confirmation',
                'Volume increase'
            ],
            entryPrice: support * 1.02,     // دخول فوق الدعم
            stopLoss: support * 0.97,      // وقف تحت الدعم
            targets: [
                resistance * 0.95,  // قبل المقاومة
                resistance * 0.98
            ],
            positionSize: CONFIG.RISK_MANAGEMENT.SIDEWAYS_MARKET.MAX_POSITION_SIZE,
            timeframe: 'short_term',
            confidence: this.calculateConfidence(coin.analysis, 'sideways'),
            notes: 'تداول النطاق - شراء من الدعم وبيع عند المقاومة'
        };
    }

    // حساب النقاط المتكيف
    calculateBullMarketScore(analysis) {
        const scoring = CONFIG.SCORING.BULL_MARKET;
        let score = 0;

        // RSI إيجابي
        if (analysis.rsi.trend === 'bullish' && analysis.rsi.signal !== 'overbought') {
            score += scoring.RSI_POSITIVE;
        }

        // MACD إيجابي
        if (analysis.macd.signal === 'bullish') {
            score += scoring.MACD_POSITIVE;
        }

        // سيولة عالية
        if (analysis.liquidityFlow.trend === 'increasing') {
            score += scoring.HIGH_LIQUIDITY;
        }

        // قوة شرائية
        if (analysis.buyingPower.strength === 'high') {
            score += scoring.BUYING_POWER;
        }

        // تقاطع المتوسطات
        if (analysis.movingAverages.signal === 'buy') {
            score += scoring.MA_CROSSOVER;
        }

        // زخم قوي
        if (this.hasMomentum(analysis)) {
            score += scoring.MOMENTUM;
        }

        // كسر حجم
        if (this.hasVolumeBreakout(analysis)) {
            score += scoring.VOLUME_BREAKOUT;
        }

        return Math.min(score, 100);
    }

    calculateBearMarketScore(analysis) {
        const scoring = CONFIG.SCORING.BEAR_MARKET;
        let score = 0;

        // RSI مشبع بيع
        if (analysis.rsi.signal === 'oversold') {
            score += scoring.RSI_OVERSOLD;
        }

        // ارتداد من الدعم
        if (this.hasSupportBounce(analysis)) {
            score += scoring.SUPPORT_BOUNCE;
        }

        // طفرة حجم
        if (this.hasVolumeSpike(analysis)) {
            score += scoring.VOLUME_SPIKE;
        }

        // تباعد إيجابي
        if (this.hasBullishDivergence(analysis)) {
            score += scoring.DIVERGENCE;
        }

        // إشارات دفاعية
        if (this.hasDefensiveSignals(analysis)) {
            score += scoring.DEFENSIVE_SIGNALS;
        }

        return Math.min(score, 100);
    }

    // مساعدات التحليل
    hasMomentum(analysis) {
        return analysis.rsi.value > 50 && 
               analysis.macd.signal === 'bullish' &&
               analysis.liquidityFlow.trend === 'increasing';
    }

    hasVolumeBreakout(analysis) {
        return parseFloat(analysis.liquidityFlow.percentage) > 50;
    }

    hasSupportBounce(analysis) {
        // منطق كشف الارتداد من الدعم
        return analysis.rsi.signal === 'oversold' && 
               analysis.accumulationDistribution.trend === 'accumulation';
    }

    hasVolumeSpike(analysis) {
        return parseFloat(analysis.liquidityFlow.percentage) > 100;
    }

    hasBullishDivergence(analysis) {
        // منطق كشف التباعد الإيجابي
        return analysis.rsi.trend === 'bullish' && 
               analysis.moneyFlowIndex.flow === 'positive';
    }

    hasDefensiveSignals(analysis) {
        return analysis.rsi.value < 40 && 
               analysis.moneyFlowIndex.signal !== 'overbought';
    }

    // تحديث العرض
    updateMarketDisplay() {
        const marketStatus = document.getElementById('marketStatus');
        const regimeInfo = this.getMarketRegimeInfo(this.marketRegime);
        
        marketStatus.className = `market-indicator ${regimeInfo.class}`;
        marketStatus.innerHTML = `
            <div class="market-regime">
                <span class="regime-icon">${regimeInfo.icon}</span>
                <span class="regime-text">${regimeInfo.text}</span>
            </div>
            <div class="market-metrics">
                <small>قوة الاتجاه: ${(this.marketMetrics.trend?.trendStrength * 100).toFixed(1)}%</small>
            </div>
        `;

        // إضافة معلومات مفصلة
        this.updateDetailedMarketInfo();
    }

    getMarketRegimeInfo(regime) {
        const regimes = {
            'bull_stable': {
                class: 'bullish',
                icon: '🚀',
                text: 'سوق صاعد مستقر'
            },
            'bull_volatile': {
                class: 'bullish volatile',
                icon: '📈⚡',
                text: 'سوق صاعد متقلب'
            },
            'bear_stable': {
                class: 'bearish',
                icon: '📉',
                text: 'سوق هابط مستقر'
            },
            'bear_volatile': {
                class: 'bearish volatile',
                icon: '📉⚡',
                text: 'سوق هابط متقلب'
            },
            'sideways_stable': {
                class: 'neutral',
                icon: '↔️',
                text: 'سوق جانبي مستقر'
            },
            'volatile_sideways': {
                class: 'neutral volatile',
                icon: '↔️⚡',
                text: 'سوق جانبي متقلب'
            },
            'neutral': {
                class: 'neutral',
                icon: '⚖️',
                text: 'سوق محايد'
            }
        };

        return regimes[regime] || regimes['neutral'];
    }

    // تحديث البيانات المحسن
    async loadData() {
        this.showLoading(true);
        
        try {
            // كشف حالة السوق أولاً
            await this.detectMarketRegime();
            
            // جلب بيانات العملات
            const tickers = await this.fetchOKXTickers();
            const candleData = await this.fetchCandleData(tickers);
            
            // تحليل العملات
            this.coins = await this.analyzeCoins(tickers, candleData);
            
            // تكييف الاستراتيجية حسب حالة السوق
            this.coins = this.coins.map(coin => 
                this.adaptStrategyToMarket(coin, this.marketRegime)
            );
            
            // ترتيب حسب النقاط المتكيفة
            this.coins.sort((a, b) => b.adaptedScore - a.adaptedScore);
            
            this.assignRanks();
            this.filterCoins();
            
            // إرسال تنبيهات للفرص الجيدة
            await this.checkAndSendAlerts();
            
            document.getElementById('lastUpdate').textContent = 
                `آخر تحديث: ${new Date().toLocaleTimeString('ar-SA')}`;
                
                } catch (error) {
            console.error('خطأ في جلب البيانات:', error);
            this.showError('حدث خطأ في جلب البيانات. يرجى المحاولة مرة أخرى.');
        } finally {
            this.showLoading(false);
        }
    }

    // نظام التنبيهات المتقدم
    async checkAndSendAlerts() {
        if (!CONFIG.ALERTS.ENABLE_NOTIFICATIONS) return;

        const highScoreCoins = this.coins.filter(coin => 
            coin.adaptedScore >= CONFIG.ALERTS.ALERT_THRESHOLDS.HIGH_SCORE
        );

        const volumeSpikeCoins = this.coins.filter(coin => 
            parseFloat(coin.analysis.liquidityFlow.percentage) >= 
            CONFIG.ALERTS.ALERT_THRESHOLDS.VOLUME_SPIKE * 100
        );

        const breakoutCoins = this.coins.filter(coin => 
            this.hasBreakoutSignal(coin)
        );

        // إرسال تنبيهات مختلفة حسب نوع الإشارة
        for (const coin of highScoreCoins) {
            await this.sendAlert('high_score', coin);
        }

        for (const coin of volumeSpikeCoins) {
            await this.sendAlert('volume_spike', coin);
        }

        for (const coin of breakoutCoins) {
            await this.sendAlert('breakout', coin);
        }

        // تنبيه تغيير حالة السوق
        if (this.hasMarketRegimeChanged()) {
            await this.sendMarketRegimeAlert();
        }
    }

    hasBreakoutSignal(coin) {
        const analysis = coin.analysis;
        const priceChange = parseFloat(analysis.priceChange24h);
        return Math.abs(priceChange) >= CONFIG.ALERTS.ALERT_THRESHOLDS.PRICE_BREAKOUT * 100;
    }

    async sendAlert(type, coin) {
        const message = this.formatAlertMessage(type, coin);
        
        if (CONFIG.ALERTS.TELEGRAM_BOT_TOKEN) {
            await this.sendTelegramAlert(message);
        }
        
        // إضافة التنبيه للواجهة
        this.addUIAlert(type, coin, message);
    }

    formatAlertMessage(type, coin) {
        const strategy = coin.strategy;
        const regime = this.getMarketRegimeInfo(coin.marketRegime);
        
        let message = `🚨 تنبيه ${this.getAlertTypeText(type)}\n\n`;
        message += `💰 العملة: ${coin.symbol}\n`;
        message += `📊 النقاط: ${coin.adaptedScore.toFixed(1)}/100\n`;
        message += `💲 السعر: $${coin.price}\n`;
        message += `📈 التغيير 24س: ${coin.analysis.priceChange24h}%\n`;
        message += `🔄 حالة السوق: ${regime.text}\n`;
        message += `⚡ مستوى المخاطر: ${this.getRiskLevelText(coin.riskLevel)}\n\n`;
        
        if (strategy) {
            message += `📋 الاستراتيجية:\n`;
            message += `🎯 نقطة الدخول: $${strategy.entryPrice?.toFixed(6)}\n`;
            message += `🛑 وقف الخسارة: $${strategy.stopLoss?.toFixed(6)}\n`;
            message += `🎯 الأهداف: ${strategy.targets?.map(t => `$${t.toFixed(6)}`).join(' | ')}\n`;
            message += `⏰ الإطار الزمني: ${this.getTimeframeText(strategy.timeframe)}\n`;
            message += `🔒 حجم المركز: ${(strategy.positionSize * 100).toFixed(1)}%\n\n`;
        }
        
        message += `⏰ الوقت: ${new Date().toLocaleString('ar-SA')}`;
        
        return message;
    }

    getAlertTypeText(type) {
        const types = {
            'high_score': 'نقاط عالية',
            'volume_spike': 'طفرة حجم',
            'breakout': 'كسر مستوى'
        };
        return types[type] || 'عام';
    }

    getRiskLevelText(level) {
        const levels = {
            'low': 'منخفض 🟢',
            'medium': 'متوسط 🟡',
            'high': 'عالي 🟠',
            'very_high': 'عالي جداً 🔴'
        };
        return levels[level] || 'غير محدد';
    }

    getTimeframeText(timeframe) {
        const timeframes = {
            'short_term': 'قصير المدى (أيام)',
            'medium_term': 'متوسط المدى (أسابيع)',
            'long_term': 'طويل المدى (شهور)'
        };
        return timeframes[timeframe] || 'غير محدد';
    }

    // تحديث العرض المحسن
    displayCoins() {
        const container = document.getElementById('coinsContainer');
        if (!container) return;

        if (this.filteredCoins.length === 0) {
            container.innerHTML = '<div class="no-results">لا توجد عملات تطابق المعايير المحددة</div>';
            return;
        }

        container.innerHTML = this.filteredCoins.map(coin => this.createEnhancedCoinCard(coin)).join('');
    }

    createEnhancedCoinCard(coin) {
        const regimeInfo = this.getMarketRegimeInfo(coin.marketRegime);
        const strategy = coin.strategy;
        
        return `
            <div class="coin-card enhanced ${coin.riskLevel}" data-symbol="${coin.symbol}">
                <div class="coin-header">
                    <div class="coin-title">
                        <h3>${coin.symbol}</h3>
                        <span class="rank">#${coin.rank}</span>
                        <span class="market-regime ${regimeInfo.class}">
                            ${regimeInfo.icon}
                        </span>
                    </div>
                    <div class="coin-price">
                        <span class="price">$${coin.price}</span>
                        <span class="change ${parseFloat(coin.analysis.priceChange24h) >= 0 ? 'positive' : 'negative'}">
                            ${coin.analysis.priceChange24h}%
                        </span>
                    </div>
                </div>

                <div class="score-section">
                    <div class="score-bar">
                        <div class="score-fill" style="width: ${coin.adaptedScore}%"></div>
                        <span class="score-text">${coin.adaptedScore.toFixed(1)}/100</span>
                    </div>
                    <div class="risk-indicator ${coin.riskLevel}">
                        ${this.getRiskLevelText(coin.riskLevel)}
                    </div>
                </div>

                <div class="analysis-grid">
                    <div class="analysis-item">
                        <span class="label">RSI:</span>
                        <span class="value ${coin.analysis.rsi.signal}">${coin.analysis.rsi.value.toFixed(1)}</span>
                    </div>
                    <div class="analysis-item">
                        <span class="label">MACD:</span>
                        <span class="value ${coin.analysis.macd.signal}">${coin.analysis.macd.signal}</span>
                    </div>
                    <div class="analysis-item">
                        <span class="label">السيولة:</span>
                        <span class="value">${coin.analysis.liquidityFlow.percentage}%</span>
                    </div>
                    <div class="analysis-item">
                        <span class="label">القوة الشرائية:</span>
                        <span class="value ${coin.analysis.buyingPower.strength}">${coin.analysis.buyingPower.strength}</span>
                    </div>
                </div>

                ${strategy ? this.createStrategySection(strategy) : ''}

                <div class="action-buttons">
                    <button class="btn-details" onclick="showCoinDetails('${coin.symbol}')">
                        تفاصيل أكثر
                    </button>
                    <button class="btn-alert" onclick="addToWatchlist('${coin.symbol}')">
                        إضافة للمراقبة
                    </button>
                    ${strategy ? `<button class="btn-strategy" onclick="showStrategy('${coin.symbol}')">عرض الاستراتيجية</button>` : ''}
                </div>
            </div>
        `;
    }

    createStrategySection(strategy) {
        return `
            <div class="strategy-section">
                <h4>📋 الاستراتيجية المقترحة</h4>
                <div class="strategy-details">
                    <div class="strategy-row">
                        <span>🎯 الدخول:</span>
                        <span>$${strategy.entryPrice?.toFixed(6)}</span>
                    </div>
                    <div class="strategy-row">
                        <span>🛑 وقف الخسارة:</span>
                        <span>$${strategy.stopLoss?.toFixed(6)}</span>
                    </div>
                    <div class="strategy-row">
                        <span>🎯 الهدف الأول:</span>
                        <span>$${strategy.targets?.[0]?.toFixed(6)}</span>
                    </div>
                    <div class="strategy-row">
                        <span>⏰ المدة:</span>
                        <span>${this.getTimeframeText(strategy.timeframe)}</span>
                    </div>
                    <div class="strategy-row">
                        <span>🔒 حجم المركز:</span>
                        <span>${(strategy.positionSize * 100).toFixed(1)}%</span>
                    </div>
                    <div class="confidence-bar">
                        <span>مستوى الثقة:</span>
                        <div class="confidence-fill" style="width: ${strategy.confidence}%"></div>
                        <span>${strategy.confidence?.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        `;
    }

    // إعداد التحديثات المتدرجة
    setupUpdateIntervals() {
        // تحديث سريع للأسعار
        setInterval(() => {
            this.updatePricesOnly();
        }, CONFIG.UPDATE_INTERVALS.FAST_UPDATE);

        // تحديث عادي للتحليل
        setInterval(() => {
            this.loadData();
        }, CONFIG.UPDATE_INTERVALS.NORMAL_UPDATE);

        // تحديث بطيء لحالة السوق
        setInterval(() => {
            this.detectMarketRegime();
        }, CONFIG.UPDATE_INTERVALS.SLOW_UPDATE);
    }

    async updatePricesOnly() {
        try {
            const tickers = await this.fetchOKXTickers();
            
            // تحديث الأسعار فقط دون إعادة التحليل الكامل
            this.coins.forEach(coin => {
                const ticker = tickers.find(t => t.instId === `${coin.symbol}-USDT`);
                if (ticker) {
                    coin.price = parseFloat(ticker.last);
                    coin.analysis.priceChange24h = ticker.sodUtc8;
                }
            });

            // تحديث العرض
            this.updatePriceDisplay();
            
        } catch (error) {
            console.error('خطأ في تحديث الأسعار:', error);
        }
    }

    updatePriceDisplay() {
        const coinCards = document.querySelectorAll('.coin-card');
        coinCards.forEach(card => {
            const symbol = card.dataset.symbol;
            const coin = this.coins.find(c => c.symbol === symbol);
            
            if (coin) {
                const priceElement = card.querySelector('.price');
                const changeElement = card.querySelector('.change');
                
                if (priceElement) priceElement.textContent = `$${coin.price}`;
                if (changeElement) {
                    changeElement.textContent = `${coin.analysis.priceChange24h}%`;
                    changeElement.className = `change ${parseFloat(coin.analysis.priceChange24h) >= 0 ? 'positive' : 'negative'}`;
                }
            }
        });
    }

    // حساب الثقة في الاستراتيجية
    calculateConfidence(analysis, marketType) {
        let confidence = 50; // نقطة البداية

        // عوامل تزيد الثقة
        if (analysis.rsi.signal === 'bullish') confidence += 10;
        if (analysis.macd.signal === 'bullish') confidence += 10;
        if (analysis.liquidityFlow.trend === 'increasing') confidence += 15;
        if (analysis.buyingPower.strength === 'high') confidence += 15;

        // تعديل حسب نوع السوق
        switch (marketType) {
            case 'bull':
                if (this.marketMetrics.trend?.bullishRatio > 0.7) confidence += 10;
                break;
            case 'bear':
                if (analysis.rsi.signal === 'oversold') confidence += 15;
                break;
            case 'sideways':
                if (this.isNearSupportResistance(analysis)) confidence += 10;
                break;
        }

        // عوامل تقلل الثقة
        if (this.marketMetrics.volatility?.regime === 'high') confidence -= 10;
        if (analysis.rsi.signal === 'overbought') confidence -= 15;

        return Math.max(0, Math.min(100, confidence));
    }

    isNearSupportResistance(analysis) {
        // منطق فحص القرب من مستويات الدعم والمقاومة
        return analysis.supportResistance && 
               (analysis.supportResistance.nearSupport || analysis.supportResistance.nearResistance);
    }

    // معالجة الأخطاء المحسنة
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div class="error-content">
                <span class="error-icon">⚠️</span>
                <span class="error-text">${message}</span>
                                <button class="error-close" onclick="this.parentElement.parentElement.remove()">
                    ✕
                </button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        // إزالة الرسالة تلقائياً بعد 5 ثوان
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }

    showLoading(show) {
        const loader = document.getElementById('loadingIndicator');
        if (loader) {
            loader.style.display = show ? 'flex' : 'none';
        }
        
        // تعطيل الأزرار أثناء التحميل
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.disabled = show;
        });
    }

    // إضافة تنبيه للواجهة
    addUIAlert(type, coin, message) {
        const alertsContainer = document.getElementById('alertsContainer') || this.createAlertsContainer();
        
        const alertElement = document.createElement('div');
        alertElement.className = `ui-alert ${type}`;
        alertElement.innerHTML = `
            <div class="alert-header">
                <span class="alert-icon">${this.getAlertIcon(type)}</span>
                <span class="alert-title">${coin.symbol} - ${this.getAlertTypeText(type)}</span>
                <button class="alert-close" onclick="this.parentElement.parentElement.remove()">✕</button>
            </div>
            <div class="alert-body">
                <div class="alert-details">
                    <span>النقاط: ${coin.adaptedScore.toFixed(1)}</span>
                    <span>السعر: $${coin.price}</span>
                    <span>المخاطر: ${this.getRiskLevelText(coin.riskLevel)}</span>
                </div>
                <div class="alert-time">${new Date().toLocaleTimeString('ar-SA')}</div>
            </div>
        `;
        
        alertsContainer.insertBefore(alertElement, alertsContainer.firstChild);
        
        // الحد من عدد التنبيهات المعروضة
        const alerts = alertsContainer.querySelectorAll('.ui-alert');
        if (alerts.length > 10) {
            alerts[alerts.length - 1].remove();
        }
        
        // إضافة تأثير الظهور
        setTimeout(() => alertElement.classList.add('show'), 100);
    }

    createAlertsContainer() {
        const container = document.createElement('div');
        container.id = 'alertsContainer';
        container.className = 'alerts-container';
        document.body.appendChild(container);
        return container;
    }

    getAlertIcon(type) {
        const icons = {
            'high_score': '⭐',
            'volume_spike': '📊',
            'breakout': '🚀'
        };
        return icons[type] || '🔔';
    }

    // إرسال تنبيه تيليجرام
    async sendTelegramAlert(message) {
        if (!CONFIG.ALERTS.TELEGRAM_BOT_TOKEN || !CONFIG.ALERTS.CHAT_ID) return;
        
        try {
            const response = await fetch(`https://api.telegram.org/bot${CONFIG.ALERTS.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: CONFIG.ALERTS.CHAT_ID,
                    text: message,
                    parse_mode: 'HTML'
                })
            });
            
            if (!response.ok) {
                console.error('فشل في إرسال تنبيه تيليجرام');
            }
        } catch (error) {
            console.error('خطأ في إرسال تنبيه تيليجرام:', error);
        }
    }

    // تنبيه تغيير حالة السوق
    async sendMarketRegimeAlert() {
        const regimeInfo = this.getMarketRegimeInfo(this.marketRegime);
        const message = `
🔄 تغيير حالة السوق

📊 الحالة الجديدة: ${regimeInfo.text}
📈 قوة الاتجاه: ${(this.marketMetrics.trend?.trendStrength * 100).toFixed(1)}%
📊 نسبة العملات الصاعدة: ${(this.marketMetrics.trend?.bullishRatio * 100).toFixed(1)}%
⚡ مستوى التقلبات: ${this.marketMetrics.volatility?.regime}

💡 توصية: تكييف الاستراتيجية حسب الحالة الجديدة
⏰ الوقت: ${new Date().toLocaleString('ar-SA')}
        `;
        
        await this.sendTelegramAlert(message);
        this.addUIAlert('market_change', { symbol: 'MARKET', adaptedScore: 0, price: 0, riskLevel: 'medium' }, message);
    }

    hasMarketRegimeChanged() {
        const previousRegime = localStorage.getItem('previousMarketRegime');
        const currentRegime = this.marketRegime;
        
        if (previousRegime && previousRegime !== currentRegime) {
            localStorage.setItem('previousMarketRegime', currentRegime);
            return true;
        }
        
        if (!previousRegime) {
            localStorage.setItem('previousMarketRegime', currentRegime);
        }
        
        return false;
    }

    // تحديث معلومات السوق المفصلة
    updateDetailedMarketInfo() {
        const detailsContainer = document.getElementById('marketDetails') || this.createMarketDetailsContainer();
        
        const metrics = this.marketMetrics;
        detailsContainer.innerHTML = `
            <div class="market-details-grid">
                <div class="metric-card">
                    <h4>📈 اتجاه السوق</h4>
                    <div class="metric-value">${(metrics.trend?.bullishRatio * 100).toFixed(1)}%</div>
                    <div class="metric-label">عملات صاعدة</div>
                </div>
                
                <div class="metric-card">
                    <h4>⚡ التقلبات</h4>
                    <div class="metric-value">${(metrics.volatility?.avgVolatility * 100).toFixed(1)}%</div>
                    <div class="metric-label">متوسط التقلب</div>
                </div>
                
                <div class="metric-card">
                    <h4>📊 الأحجام</h4>
                    <div class="metric-value">${metrics.volume?.trend || 'N/A'}</div>
                    <div class="metric-label">اتجاه الحجم</div>
                </div>
                
                <div class="metric-card">
                    <h4>💪 قوة السوق</h4>
                    <div class="metric-value">${metrics.strength?.avgRSI?.toFixed(1) || 'N/A'}</div>
                    <div class="metric-label">متوسط RSI</div>
                </div>
            </div>
            
            <div class="regime-recommendations">
                <h4>💡 توصيات الحالة الحالية</h4>
                ${this.getRegimeRecommendations(this.marketRegime)}
            </div>
        `;
    }

    createMarketDetailsContainer() {
        const container = document.createElement('div');
        container.id = 'marketDetails';
        container.className = 'market-details-container';
        
        const marketStatus = document.getElementById('marketStatus');
        if (marketStatus && marketStatus.parentElement) {
            marketStatus.parentElement.appendChild(container);
        }
        
        return container;
    }

    getRegimeRecommendations(regime) {
        const recommendations = {
            'bull_stable': `
                <ul>
                    <li>🎯 ركز على العملات ذات الزخم القوي</li>
                    <li>📈 استخدم استراتيجيات النمو</li>
                    <li>⏰ فكر في المراكز متوسطة المدى</li>
                    <li>💰 يمكن زيادة حجم المراكز تدريجياً</li>
                </ul>
            `,
            'bull_volatile': `
                <ul>
                    <li>⚡ كن حذراً من التقلبات العالية</li>
                    <li>🎯 استهدف أرباح سريعة</li>
                    <li>🛑 استخدم وقف خسارة ضيق</li>
                    <li>📊 راقب الأحجام بعناية</li>
                </ul>
            `,
            'bear_stable': `
                <ul>
                    <li>🔍 ابحث عن إشارات الارتداد</li>
                    <li>💎 ركز على العملات القوية فقط</li>
                    <li>🛡️ قلل من المخاطر</li>
                    <li>⏳ كن صبوراً في الدخول</li>
                </ul>
            `,
            'bear_volatile': `
                <ul>
                    <li>🚨 تجنب المراكز الكبيرة</li>
                    <li>⚡ تداول سريع فقط</li>
                    <li>🛑 وقف خسارة صارم</li>
                    <li>💰 احتفظ بالسيولة</li>
                </ul>
            `,
            'sideways_stable': `
                <ul>
                    <li>↔️ استخدم استراتيجية النطاق</li>
                    <li>🎯 اشتري من الدعم، بع عند المقاومة</li>
                    <li>📊 راقب مستويات الدعم والمقاومة</li>
                    <li>⏰ تداول قصير المدى</li>
                </ul>
            `,
            'volatile_sideways': `
                <ul>
                    <li>⚡ استغل التقلبات السريعة</li>
                    <li>🎯 أهداف ربح صغيرة ومتكررة</li>
                    <li>🛑 إدارة مخاطر صارمة</li>
                    <li>📈 انتظر إشارات الكسر</li>
                </ul>
            `,
            'neutral': `
                <ul>
                    <li>⚖️ حافظ على التوازن</li>
                    <li>👀 راقب تطور الحالة</li>
                    <li>🔍 ابحث عن الفرص الفردية</li>
                    <li>💼 نوع المحفظة</li>
                </ul>
            `
        };
        
        return recommendations[regime] || recommendations['neutral'];
    }
}

// تهيئة النظام المحسن
document.addEventListener('DOMContentLoaded', function() {
    window.detector = new EnhancedCryptoPumpDetector();
});

// دوال مساعدة للواجهة
function showCoinDetails(symbol) {
    const coin = window.detector.coins.find(c => c.symbol === symbol);
    if (!coin) return;
    
    const modal = createDetailsModal(coin);
    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

function createDetailsModal(coin) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${coin.symbol} - تفاصيل التحليل</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="details-grid">
                    <div class="detail-section">
                        <h3>📊 المؤشرات الفنية</h3>
                        <div class="indicators-list">
                            <div class="indicator">
                                <span>RSI:</span>
                                <span class="${coin.analysis.rsi.signal}">${coin.analysis.rsi.value.toFixed(2)}</span>
                            </div>
                            <div class="indicator">
                                <span>MACD:</span>
                                <span class="${coin.analysis.macd.signal}">${coin.analysis.macd.signal}</span>
                            </div>
                            <div class="indicator">
                                <span>تدفق السيولة:</span>
                                <span>${coin.analysis.liquidityFlow.percentage}%</span>
                            </div>
                            <div class="indicator">
                                <span>القوة الشرائية:</span>
                                <span class="${coin.analysis.buyingPower.strength}">${coin.analysis.buyingPower.strength}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${coin.strategy ? createDetailedStrategy(coin.strategy) : ''}
                    
                    <div class="detail-section">
                        <h3>⚠️ تحليل المخاطر</h3>
                        <div class="risk-analysis">
                            <div class="risk-level ${coin.riskLevel}">
                                مستوى المخاطر: ${this.getRiskLevelText(coin.riskLevel)}
                            </div>
                            <div class="risk-factors">
                                ${this.getRiskFactors(coin)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return modal;
}

function createDetailedStrategy(strategy) {
    return `
        <div class="detail-section">
            <h3>🎯 الاستراتيجية التفصيلية</h3>
            <div class="strategy-detailed">
                <div class="strategy-overview">
                    <strong>نوع الاستراتيجية:</strong> ${strategy.type}
                </div>
                
                <div class="entry-conditions">
                    <strong>شروط الدخول:</strong>
                    <ul>
                        ${strategy.entryConditions.map(condition => `<li>${condition}
                        ${strategy.entryConditions.map(condition => `<li>${condition}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="price-levels">
                    <div class="price-level entry">
                        <span>🎯 نقطة الدخول:</span>
                        <span>$${strategy.entryPrice?.toFixed(6)}</span>
                    </div>
                    <div class="price-level stop">
                        <span>🛑 وقف الخسارة:</span>
                        <span>$${strategy.stopLoss?.toFixed(6)}</span>
                        <small>(${(((strategy.entryPrice - strategy.stopLoss) / strategy.entryPrice) * 100).toFixed(1)}%)</small>
                    </div>
                    <div class="targets-list">
                        <span>🎯 الأهداف:</span>
                        <div class="targets">
                            ${strategy.targets?.map((target, index) => `
                                <div class="target">
                                    <span>هدف ${index + 1}:</span>
                                    <span>$${target.toFixed(6)}</span>
                                    <small>(+${(((target - strategy.entryPrice) / strategy.entryPrice) * 100).toFixed(1)}%)</small>
                                </div>
                            `).join('') || ''}
                        </div>
                    </div>
                </div>
                
                <div class="strategy-metrics">
                    <div class="metric">
                        <span>⏰ الإطار الزمني:</span>
                        <span>${window.detector.getTimeframeText(strategy.timeframe)}</span>
                    </div>
                    <div class="metric">
                        <span>🔒 حجم المركز:</span>
                        <span>${(strategy.positionSize * 100).toFixed(1)}% من المحفظة</span>
                    </div>
                    <div class="metric">
                        <span>📊 مستوى الثقة:</span>
                        <span>${strategy.confidence?.toFixed(1)}%</span>
                    </div>
                    <div class="metric">
                        <span>💰 نسبة المخاطرة/الربح:</span>
                        <span>1:${((strategy.targets?.[0] - strategy.entryPrice) / (strategy.entryPrice - strategy.stopLoss)).toFixed(1)}</span>
                    </div>
                </div>
                 }
    }
}

// تشغيل الكاشف
window.detector = new EnhancedCryptoPumpDetector();

// الدوال المطلوبة
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
        console.error('خطأ في إضافة العملة:', e);
    }
}

function showStrategy(symbol) {
    alert('📊 استراتيجية ' + symbol + ' قيد التطوير');
}

function updateWatchlistCounter() {
    try {
        const watchlist = JSON.parse(localStorage.getItem('cryptoWatchlist') || '[]');
        const counter = document.querySelector('.watchlist-counter');
        if (counter) counter.textContent = watchlist.length;
    } catch(e) {
        console.error('خطأ في تحديث العداد:', e);
    }
}

function showWatchlist() { alert('📋 قائمة المراقبة'); }
function showAlertsManager() { alert('🔔 إدارة التنبيهات'); }
function showStatistics() { alert('📈 الإحصائيات'); }
function exportAllData() { alert('💾 تصدير البيانات'); }
function copyStrategyToClipboard(symbol) { alert('📋 نسخ استراتيجية: ' + symbol); }
function setStrategyAlert(symbol) { alert('🔔 تنبيه للعملة: ' + symbol); }
function exportStrategy(symbol) { alert('💾 تصدير استراتيجية: ' + symbol); }


// إغلاق جميع الأقواس المفقودة
        }
    }
}

// إنهاء الكلاس
}

// تشغيل الكاشف
document.addEventListener('DOMContentLoaded', function() {
    window.detector = new EnhancedCryptoPumpDetector();
    updateWatchlistCounter();
});

// جميع الدوال المطلوبة
function addToWatchlist(symbol) {
    try {
        let watchlist = JSON.parse(localStorage.getItem('cryptoWatchlist') || '[]');
        if (!watchlist.includes(symbol)) {
            watchlist.push(symbol);
            localStorage.setItem('cryptoWatchlist', JSON.stringify(watchlist));
            alert('✅ تم إضافة ' + symbol + ' إلى قائمة المراقبة');
            updateWatchlistCounter();
        } else {
            alert('ℹ️ ' + symbol + ' موجود بالفعل');
        }
    } catch(e) {
        alert('❌ خطأ في إضافة العملة');
    }
}

function showStrategy(symbol) {
    alert('📊 استراتيجية ' + symbol);
}

function updateWatchlistCounter() {
    try {
        const watchlist = JSON.parse(localStorage.getItem('cryptoWatchlist') || '[]');
        const counter = document.querySelector('.watchlist-counter');
        if (counter) {
            counter.textContent = watchlist.length;
        }
    } catch(e) {
        console.log('تحديث العداد...');
    }
}

function showWatchlist() {
    const watchlist = JSON.parse(localStorage.getItem('cryptoWatchlist') || '[]');
    alert('📋 قائمة المراقبة: ' + (watchlist.length > 0 ? watchlist.join(', ') : 'فارغة'));
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
    navigator.clipboard.writeText('استراتيجية ' + symbol).then(() => {
        alert('📋 تم نسخ استراتيجية ' + symbol);
    }).catch(() => {
        alert('📋 استراتيجية ' + symbol);
    });
}

function setStrategyAlert(symbol) {
    alert('🔔 تم تعيين تنبيه للعملة: ' + symbol);
}

function exportStrategy(symbol) {
    alert('💾 تصدير استراتيجية: ' + symbol);
}

// تأكد من تحميل العداد عند تحميل الصفحة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateWatchlistCounter);
} else {
    updateWatchlistCounter();
}

