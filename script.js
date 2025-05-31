class CryptoPumpDetector {
    constructor() {
        this.coins = [];
        this.filteredCoins = [];
        this.currentFilter = 'all';
        this.isLoading = false;
        this.marketRegime = 'neutral';
        this.marketVolatility = 'normal';
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadData();
        
        setInterval(() => {
            if (!this.isLoading) {
                this.loadData();
            }
        }, 300000);
    }

    bindEvents() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setActiveFilter(e.target);
                this.currentFilter = e.target.dataset.score;
                this.filterCoins();
            });
        });

        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadData();
        });

        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') {
                this.closeModal();
            }
        });
    }

    setActiveFilter(activeBtn) {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        activeBtn.classList.add('active');
    }

    async loadData() {
        this.showLoading(true);
        
        try {
            const tickers = await this.fetchOKXTickers();
            const candleData = await this.fetchCandleData(tickers);
            
            // تحديد نظام السوق أولاً
            this.detectMarketRegime(tickers, candleData);
            
            // تحليل العملات بناءً على نظام السوق
            this.coins = await this.analyzeCoins(tickers, candleData);
            
            this.coins.sort((a, b) => b.score - a.score);
            this.assignRanks();
            this.filterCoins();
            
            document.getElementById('lastUpdate').textContent = 
                `آخر تحديث: ${new Date().toLocaleTimeString('ar-SA')}`;
                
        } catch (error) {
            console.error('خطأ في جلب البيانات:', error);
            this.showError('حدث خطأ في جلب البيانات. يرجى المحاولة مرة أخرى.');
        }
        
        this.showLoading(false);
    }

    async fetchOKXTickers() {
        const response = await fetch(`${CONFIG.OKX_API.BASE_URL}/market/tickers?instType=SPOT`);
        const data = await response.json();
        
        if (data.code !== '0') {
            throw new Error('فشل في جلب بيانات الأسعار');
        }
        
        return data.data.filter(ticker => {
            const symbol = ticker.instId;
            const baseSymbol = symbol.replace('-USDT', '');
            
            return symbol.endsWith('-USDT') &&
                   !CONFIG.FILTERS.EXCLUDED_SYMBOLS.includes(baseSymbol) &&
                   parseFloat(ticker.last) >= CONFIG.FILTERS.MIN_PRICE &&
                   parseFloat(ticker.vol24h) >= CONFIG.FILTERS.MIN_VOLUME;
        });
    }

    async fetchCandleData(tickers) {
        const candlePromises = tickers.slice(0, 100).map(async (ticker) => {
            try {
                const response = await fetch(
                    `${CONFIG.OKX_API.BASE_URL}/market/candles?instId=${ticker.instId}&bar=1D&limit=30`
                );
                const data = await response.json();
                return {
                    symbol: ticker.instId,
                    candles: data.code === '0' ? data.data : []
                };
            } catch (error) {
                return { symbol: ticker.instId, candles: [] };
            }
        });
        
        return await Promise.all(candlePromises);
    }

    detectMarketRegime(tickers, candleData) {
        const topTickers = tickers.slice(0, 50);
        let bullishCount = 0;
        let bearishCount = 0;
        let volatilitySum = 0;
        
        topTickers.forEach(ticker => {
            const change24h = parseFloat(ticker.sodUtc8);
            const candles = candleData.find(c => c.symbol === ticker.instId)?.candles || [];
            
            if (change24h > 2) bullishCount++;
            else if (change24h < -2) bearishCount++;
            
            if (candles.length >= 7) {
                const prices = candles.slice(0, 7).map(c => parseFloat(c[4]));
                const volatility = this.calculateVolatility(prices);
                volatilitySum += volatility;
            }
        });
        
        const avgVolatility = volatilitySum / topTickers.length;
        
        // تحديد نظام السوق
        if (bullishCount > bearishCount * 1.5) {
            this.marketRegime = 'bull';
        } else if (bearishCount > bullishCount * 1.5) {
            this.marketRegime = 'bear';
        } else {
            this.marketRegime = 'sideways';
        }
        
        // تحديد التقلبات
        this.marketVolatility = avgVolatility > 15 ? 'high' : avgVolatility > 8 ? 'normal' : 'low';
        
        this.updateMarketStatus();
    }

    calculateVolatility(prices) {
        if (prices.length < 2) return 0;
        
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i-1] - prices[i]) / prices[i] * 100);
        }
        
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        
        return Math.sqrt(variance);
    }

    updateMarketStatus() {
        const marketStatus = document.getElementById('marketStatus');
        
        const statusConfig = {
            bull: { text: 'سوق صاعد 🚀', class: 'bullish' },
            bear: { text: 'سوق هابط 📉', class: 'bearish' },
            sideways: { text: 'سوق متقلب ⚡', class: 'neutral' }
        };
        
        const config = statusConfig[this.marketRegime];
        marketStatus.className = `market-indicator ${config.class}`;
        marketStatus.textContent = `${config.text} | تقلبات: ${this.getVolatilityText()}`;
    }

    getVolatilityText() {
        const volatilityMap = {
            high: 'عالية',
            normal: 'متوسطة', 
            low: 'منخفضة'
        };
        return volatilityMap[this.marketVolatility];
    }

    async analyzeCoins(tickers, candleData) {
        const analyzedCoins = [];
        
        for (let i = 0; i < Math.min(tickers.length, 100); i++) {
            const ticker = tickers[i];
            const candles = candleData.find(c => c.symbol === ticker.instId)?.candles || [];
            
            if (candles.length < 20) continue;
            
            const analysis = await this.performTechnicalAnalysis(ticker, candles);
            const score = this.calculateAdaptiveScore(analysis, ticker);
            
            analyzedCoins.push({
                symbol: ticker.instId.replace('-USDT', ''),
                fullSymbol: ticker.instId,
                price: parseFloat(ticker.last),
                change24h: parseFloat(ticker.sodUtc8),
                volume24h: parseFloat(ticker.vol24h),
                analysis,
                score,
                rank: 0,
                marketRegime: this.marketRegime
            });
        }
        
        return analyzedCoins;
    }

    async performTechnicalAnalysis(ticker, candles) {
        const prices = candles.map(c => parseFloat(c[4]));
        const volumes = candles.map(c => parseFloat(c[5]));
        const highs = candles.map(c => parseFloat(c[2]));
        const lows = candles.map(c => parseFloat(c[3]));
        
        return {
            liquidityFlow: this.calculateLiquidityFlow(volumes.slice(0, 7)),
            buyingPower: this.calculateBuyingPower(ticker, volumes),
            accumulationDistribution: this.calculateAccumulationDistribution(prices.slice(0, 7), volumes.slice(0, 7)),
            movingAverages: this.calculateMovingAverages(prices),
            rsi: this.calculateRSI(prices),
            macd: this.calculateMACD(prices),
            moneyFlowIndex: this.calculateMFI(highs, lows, prices, volumes),
            supportResistance: this.calculateSupportResistance(highs, lows),
            entryPoint: this.calculateAdaptiveEntryPoint(prices, volumes),
            stopLoss: this.calculateAdaptiveStopLoss(prices),
            volatility: this.calculateVolatility(prices.slice(0, 7)),
            trendStrength: this.calculateTrendStrength(prices)
        };
    }

    calculateAdaptiveScore(analysis, ticker) {
        let score = 0;
        const change24h = parseFloat(ticker.sodUtc8);
        
        // تكييف النقاط حسب نظام السوق
        const regimeMultipliers = {
            bull: { positive: 1.2, negative: 0.8 },
            bear: { positive: 0.8, negative: 1.2 },
            sideways: { positive: 1.0, negative: 1.0 }
        };
        
        const multiplier = regimeMultipliers[this.marketRegime];
        
        // نقاط RSI مع التكييف
        if (analysis.rsi.trend === 'bullish' && analysis.rsi.signal !== 'overbought') {
            score += CONFIG.SCORING.RSI_POSITIVE * multiplier.positive;
        }
        
        // نقاط MACD مع التكييف
        if (analysis.macd.signal === 'bullish') {
            score += CONFIG.SCORING.MACD_POSITIVE * multiplier.positive;
        }
        
        // تقييم خاص للسوق الهابط
        if (this.marketRegime === 'bear') {
            // في السوق الهابط، نركز على العملات المقاومة للهبوط
            if (change24h > -2 && analysis.rsi.value < 40) {
                score += 15; // مكافأة للمقاومة
            }
            
            // تقليل نقاط العملات شديدة الارتفاع في السوق الهابط
            if (change24h > 10) {
                score *= 0.7;
            }
        }
        
        // تقييم خاص للسوق المتقلب
        if (this.marketRegime === 'sideways') {
            // في السوق المتقلب، نركز على التقلبات والأحجام
            if (analysis.volatility > 8 && analysis.liquidityFlow.trend === 'increasing') {
                score += 12;
            }
            
            // مكافأة للعملات ذات الدعوم القوية
            const supportStrength = (analysis.supportResistance.support1 / parseFloat(ticker.last)) * 100;
            if (supportStrength > 95) {
                score += 8;
            }
        }
        
        // تقييم خاص للسوق الصاعد
        if (this.marketRegime === 'bull') {
            // في السوق الصاعد، نركز على الزخم
            if (analysis.trendStrength > 0.6 && change24h > 5) {
                score += 15;
            }
        }
        
        // تعديل النقاط حسب التقلبات
        if (this.marketVolatility === 'high') {
            // في التقلبات العالية، نقلل المخاطرة
            score *= 0.9;
            
            // مكافأة للعملات المستقرة نسبياً
            if (analysis.volatility < 10) {
                score += 8;
            }
        }
        
        // باقي المؤشرات مع التكييف
        if (analysis.liquidityFlow.trend === 'increasing' && parseFloat(analysis.liquidityFlow.percentage) > 20) {
            score += CONFIG.SCORING.HIGH_LIQUIDITY * multiplier.positive;
        }
        
        if (analysis.buyingPower.strength === 'high') {
            score += CONFIG.SCORING.BUYING_POWER * multiplier.positive;
        }
        
        if (analysis.movingAverages.signal === 'buy' && analysis.movingAverages.priceAboveMA) {
            score += CONFIG.SCORING.MA_CROSSOVER * multiplier.positive;
        }
        
        return Math.min(Math.max(score, 0), 100);
    }

    calculateTrendStrength(prices) {
        if (prices.length < 10) return 0;
        
        let upDays = 0;
        let downDays = 0;
        
        for (let i = 1; i < Math.min(prices.length, 10); i++) {
            if (prices[i-1] > prices[i]) upDays++;
            else if (prices[i-1] < prices[i]) downDays++;
        }
        
        return upDays / (upDays + downDays);
    }

       calculateAdaptiveEntryPoint(prices, volumes) {
        const currentPrice = prices[0];
        const avgVolume = volumes.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
        const recentVolume = volumes[0];
        
        let entryMultiplier = 0.995; // افتراضي
        
        // تكييف نقطة الدخول حسب نظام السوق
        switch (this.marketRegime) {
            case 'bull':
                entryMultiplier = recentVolume > avgVolume * 1.2 ? 0.998 : 1.002; // دخول أسرع
                break;
            case 'bear':
                entryMultiplier = 0.985; // انتظار هبوط أكبر
                break;
            case 'sideways':
                entryMultiplier = recentVolume > avgVolume * 1.5 ? 0.992 : 0.988; // حذر متوسط
                break;
        }
        
        // تعديل إضافي حسب التقلبات
        if (this.marketVolatility === 'high') {
            entryMultiplier *= 0.995; // حذر إضافي
        }
        
        const entryPrice = currentPrice * entryMultiplier;
        
        return {
            price: entryPrice.toFixed(6),
            confidence: this.calculateEntryConfidence(recentVolume, avgVolume),
            strategy: this.getEntryStrategy()
        };
    }

    calculateAdaptiveStopLoss(prices) {
        const currentPrice = prices[0];
        const recentLow = Math.min(...prices.slice(0, 7));
        
        let stopLossPercentage = 0.95; // افتراضي 5%
        
        // تكييف وقف الخسارة حسب نظام السوق
        switch (this.marketRegime) {
            case 'bull':
                stopLossPercentage = 0.92; // وقف خسارة أوسع في السوق الصاعد
                break;
            case 'bear':
                stopLossPercentage = 0.97; // وقف خسارة ضيق في السوق الهابط
                break;
            case 'sideways':
                stopLossPercentage = 0.94; // وقف خسارة متوسط
                break;
        }
        
        // تعديل حسب التقلبات
        if (this.marketVolatility === 'high') {
            stopLossPercentage *= 0.98; // وقف خسارة أضيق للتقلبات العالية
        }
        
        const stopLoss = Math.min(currentPrice * stopLossPercentage, recentLow * 0.98);
        
        return {
            price: stopLoss.toFixed(6),
            percentage: (((currentPrice - stopLoss) / currentPrice) * 100).toFixed(2),
            type: this.getStopLossType()
        };
    }

    calculateEntryConfidence(recentVolume, avgVolume) {
        const volumeRatio = recentVolume / avgVolume;
        
        if (this.marketRegime === 'bull' && volumeRatio > 1.5) return 'high';
        if (this.marketRegime === 'bear' && volumeRatio > 2.0) return 'high';
        if (this.marketRegime === 'sideways' && volumeRatio > 1.8) return 'high';
        
        return volumeRatio > 1.2 ? 'medium' : 'low';
    }

    getEntryStrategy() {
        const strategies = {
            bull: 'دخول تدريجي مع الزخم',
            bear: 'انتظار إشارات انعكاس قوية',
            sideways: 'استغلال التذبذبات والدعوم'
        };
        return strategies[this.marketRegime];
    }

    getStopLossType() {
        const types = {
            bull: 'وقف خسارة متحرك',
            bear: 'وقف خسارة ثابت ضيق',
            sideways: 'وقف خسارة تحت الدعم'
        };
        return types[this.marketRegime];
    }

    // باقي الدوال الأساسية (بدون تغيير)
    calculateLiquidityFlow(volumes) {
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const recentVolume = volumes.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        
        return {
            percentage: ((recentVolume / avgVolume - 1) * 100).toFixed(2),
            trend: recentVolume > avgVolume ? 'increasing' : 'decreasing'
        };
    }

    calculateBuyingPower(ticker, volumes) {
        const totalVolume = parseFloat(ticker.vol24h);
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        
        return {
            percentage: ((totalVolume / avgVolume - 1) * 100).toFixed(2),
            strength: totalVolume > avgVolume * 1.5 ? 'high' : totalVolume > avgVolume ? 'medium' : 'low'
        };
    }

    calculateAccumulationDistribution(prices, volumes) {
        let ad = 0;
        for (let i = 1; i < prices.length; i++) {
            const clv = ((prices[i] - prices[i-1]) / (prices[i] + prices[i-1])) * volumes[i];
            ad += clv;
        }
        
        return {
            value: ad,
            percentage: (ad / volumes.reduce((a, b) => a + b, 0) * 100).toFixed(2),
            trend: ad > 0 ? 'accumulation' : 'distribution'
        };
    }

    calculateMovingAverages(prices) {
        const ma7 = this.simpleMovingAverage(prices, 7);
        const ma25 = this.simpleMovingAverage(prices, 25);
        const currentPrice = prices[0];
        
        return {
            ma7: ma7.toFixed(6),
            ma25: ma25.toFixed(6),
            crossover: ma7 > ma25 ? 'bullish' : 'bearish',
            priceAboveMA: currentPrice > ma7 && currentPrice > ma25,
            signal: ma7 > ma25 && currentPrice > ma7 ? 'buy' : 'sell'
        };
    }

    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return { value: 50, signal: 'neutral', trend: 'neutral' };
        
        let gains = 0;
        let losses = 0;
        
        for (let i = 1; i <= period; i++) {
            const change = prices[i-1] - prices[i];
            if (change > 0) gains += change;
            else losses -= change;
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        
        return {
            value: rsi.toFixed(2),
            signal: rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral',
            trend: rsi > 50 ? 'bullish' : 'bearish'
        };
    }

    calculateMACD(prices) {
        const ema12 = this.exponentialMovingAverage(prices, 12);
        const ema26 = this.exponentialMovingAverage(prices, 26);
        const macdLine = ema12 - ema26;
        
        return {
            value: macdLine.toFixed(6),
            signal: macdLine > 0 ? 'bullish' : 'bearish',
            crossover: macdLine > 0 ? 'above_zero' : 'below_zero',
            trend: macdLine > 0 ? 'uptrend' : 'downtrend'
        };
    }

    calculateMFI(highs, lows, closes, volumes, period = 14) {
        if (closes.length < period + 1) return { value: 50, signal: 'neutral', flow: 'neutral' };
        
        let positiveFlow = 0;
        let negativeFlow = 0;
        
        for (let i = 1; i <= period; i++) {
            const typicalPrice = (highs[i-1] + lows[i-1] + closes[i-1]) / 3;
            const prevTypicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
            const rawMoneyFlow = typicalPrice * volumes[i-1];
            
            if (typicalPrice > prevTypicalPrice) {
                positiveFlow += rawMoneyFlow;
            } else {
                negativeFlow += rawMoneyFlow;
            }
        }
        
        const mfi = 100 - (100 / (1 + (positiveFlow / negativeFlow)));
        
        return {
            value: mfi.toFixed(2),
            signal: mfi > 80 ? 'overbought' : mfi < 20 ? 'oversold' : 'neutral',
            flow: positiveFlow > negativeFlow ? 'positive' : 'negative'
        };
    }

    calculateSupportResistance(highs, lows) {
        const sortedHighs = [...highs].sort((a, b) => b - a);
        const sortedLows = [...lows].sort((a, b) => a - b);
        
        return {
            resistance1: sortedHighs[0],
            resistance2: sortedHighs[1],
            support1: sortedLows[0],
            support2: sortedLows[1]
        };
    }

    simpleMovingAverage(prices, period) {
        if (prices.length < period) return prices[0];
        return prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    }

    exponentialMovingAverage(prices, period) {
        if (prices.length < period) return prices[0];
        
        const multiplier = 2 / (period + 1);
        let ema = prices[period - 1];
        
        for (let i = period - 2; i >= 0; i--) {
            ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
        }
        
        return ema;
    }

    assignRanks() {
        this.coins.forEach((coin, index) => {
            coin.rank = index + 1;
        });
    }

    filterCoins() {
        if (this.currentFilter === 'all') {
            this.filteredCoins = this.coins;
        } else {
            const minScore = parseInt(this.currentFilter);
            this.filteredCoins = this.coins.filter(coin => coin.score >= minScore);
        }
        
        this.renderCoins();
    }

    renderCoins() {
        const grid = document.getElementById('coinsGrid');
        grid.innerHTML = '';
        
        if (this.filteredCoins.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 50px;">
                    <i class="fas fa-search" style="font-size: 3rem; opacity: 0.3; margin-bottom: 20px;"></i>
                    <p style="font-size: 1.2rem; opacity: 0.7;">لا توجد عملات تطابق المعايير المحددة</p>
                </div>
            `;
            return;
        }
        
        this.filteredCoins.forEach((coin, index) => {
            const card = this.createCoinCard(coin, index);
            grid.appendChild(card);
        });
    }

    createCoinCard(coin, index) {
        const card = document.createElement('div');
        card.className = 'coin-card';
        card.style.animationDelay = `${index * 0.1}s`;
        
        const changeClass = coin.change24h >= 0 ? 'price-positive' : 'price-negative';
        const changeIcon = coin.change24h >= 0 ? '📈' : '📉';
        const regimeIcon = this.getRegimeIcon(coin.marketRegime);
        
        card.innerHTML = `
            <div class="coin-header">
                <div class="coin-info">
                    <div class="coin-logo">
                        ${coin.symbol.charAt(0)}
                    </div>
                    <div class="coin-name">${coin.symbol}</div>
                    <div class="market-regime">${regimeIcon}</div>
                </div>
                <div class="coin-rank">المركز ${coin.rank}</div>
            </div>
            
            <div class="coin-metrics">
                <div class="metric">
                    <div class="metric-label">السعر الحالي</div>
                    <div class="metric-value">$${coin.price.toFixed(6)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">التغيير 24س</div>
                    <div class="metric-value ${changeClass}">
                        ${coin.change24h.toFixed(2)}% ${changeIcon}
                    </div>
                </div>
                <div class="metric">
                    <div class="metric-label">حجم التداول</div>
                    <div class="metric-value">${this.formatVolume(coin.volume24h)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">استراتيجية السوق</div>
                    <div class="metric-value">${this.getMarketStrategy()}</div>
                </div>
            </div>
            
            <div class="score-section">
                <div class="score-bar">
                    <div class="score-fill" style="width: ${coin.score}%"></div>
                </div>
                <div class="score-text">${coin.score}/100 نقطة</div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            this.showCoinDetails(coin);
        });
        
        return card;
    }

    getRegimeIcon(regime) {
        const icons = {
            bull: '🚀',
            bear: '🐻',
            sideways: '⚡'
        };
        return icons[regime] || '📊';
    }

      getMarketStrategy() {
        const strategies = {
            bull: 'تتبع الزخم',
            bear: 'انتظار الانعكاس',
            sideways: 'استغلال التذبذب'
        };
        return strategies[this.marketRegime] || 'تحليل عام';
    }

    formatVolume(volume) {
        if (volume >= 1000000000) {
            return (volume / 1000000000).toFixed(2) + 'B';
        } else if (volume >= 1000000) {
            return (volume / 1000000).toFixed(2) + 'M';
        } else if (volume >= 1000) {
            return (volume / 1000).toFixed(2) + 'K';
        }
        return volume.toFixed(2);
    }

    showCoinDetails(coin) {
        const modal = document.getElementById('modalOverlay');
        const title = document.getElementById('modalTitle');
        const content = document.getElementById('modalContent');
        
        title.innerHTML = `
            <i class="fas fa-chart-line"></i>
            تحليل تفصيلي - ${coin.symbol} ${this.getRegimeIcon(coin.marketRegime)}
        `;
        
        content.innerHTML = this.generateDetailedAnalysis(coin);
        modal.style.display = 'flex';
        
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);
    }

    generateDetailedAnalysis(coin) {
        const analysis = coin.analysis;
        
        return `
            <div class="analysis-section">
                <div class="analysis-title">
                    <i class="fas fa-info-circle"></i> معلومات أساسية
                </div>
                <div class="indicator-grid">
                    <div class="indicator-item">
                        <div class="indicator-label">السعر الحالي</div>
                        <div class="indicator-value">$${coin.price.toFixed(6)}</div>
                    </div>
                    <div class="indicator-item">
                        <div class="indicator-label">التغيير 24 ساعة</div>
                        <div class="indicator-value ${coin.change24h >= 0 ? 'indicator-positive' : 'indicator-negative'}">
                            ${coin.change24h.toFixed(2)}%
                        </div>
                    </div>
                    <div class="indicator-item">
                        <div class="indicator-label">حجم التداول</div>
                        <div class="indicator-value">${this.formatVolume(coin.volume24h)}</div>
                    </div>
                    <div class="indicator-item">
                        <div class="indicator-label">النقاط الإجمالية</div>
                        <div class="indicator-value indicator-positive">${coin.score}/100</div>
                    </div>
                </div>
            </div>

            <div class="analysis-section">
                <div class="analysis-title">
                    <i class="fas fa-chart-bar"></i> المؤشرات الفنية
                </div>
                <div class="indicator-grid">
                    <div class="indicator-item">
                        <div class="indicator-label">مؤشر RSI</div>
                        <div class="indicator-value ${this.getIndicatorClass(analysis.rsi.trend)}">
                            ${analysis.rsi.value} - ${this.getArabicSignal(analysis.rsi.signal)}
                        </div>
                    </div>
                    <div class="indicator-item">
                        <div class="indicator-label">مؤشر MACD</div>
                        <div class="indicator-value ${this.getIndicatorClass(analysis.macd.signal)}">
                            ${analysis.macd.value} - ${this.getArabicSignal(analysis.macd.signal)}
                        </div>
                    </div>
                    <div class="indicator-item">
                        <div class="indicator-label">تدفق السيولة</div>
                        <div class="indicator-value ${this.getIndicatorClass(analysis.liquidityFlow.trend)}">
                            ${analysis.liquidityFlow.percentage}%
                        </div>
                    </div>
                    <div class="indicator-item">
                        <div class="indicator-label">القوة الشرائية</div>
                        <div class="indicator-value ${this.getIndicatorClass(analysis.buyingPower.strength)}">
                            ${analysis.buyingPower.percentage}% - ${this.getArabicStrength(analysis.buyingPower.strength)}
                        </div>
                    </div>
                </div>
            </div>

            <div class="analysis-section">
                <div class="analysis-title">
                    <i class="fas fa-crosshairs"></i> المتوسطات المتحركة
                </div>
                <div class="indicator-grid">
                    <div class="indicator-item">
                        <div class="indicator-label">متوسط 7 أيام</div>
                        <div class="indicator-value">$${analysis.movingAverages.ma7}</div>
                    </div>
                    <div class="indicator-item">
                        <div class="indicator-label">متوسط 25 يوم</div>
                        <div class="indicator-value">$${analysis.movingAverages.ma25}</div>
                    </div>
                    <div class="indicator-item">
                        <div class="indicator-label">حالة التقاطع</div>
                        <div class="indicator-value ${this.getIndicatorClass(analysis.movingAverages.crossover)}">
                            ${this.getArabicCrossover(analysis.movingAverages.crossover)}
                        </div>
                    </div>
                    <div class="indicator-item">
                        <div class="indicator-label">إشارة التداول</div>
                        <div class="indicator-value ${this.getIndicatorClass(analysis.movingAverages.signal)}">
                            ${this.getArabicSignal(analysis.movingAverages.signal)}
                        </div>
                    </div>
                </div>
            </div>

            <div class="analysis-section">
                <div class="analysis-title">
                    <i class="fas fa-balance-scale"></i> التجميع والتصريف
                </div>
                <div class="indicator-grid">
                    <div class="indicator-item">
                        <div class="indicator-label">النسبة المئوية</div>
                        <div class="indicator-value ${this.getIndicatorClass(analysis.accumulationDistribution.trend)}">
                            ${analysis.accumulationDistribution.percentage}%
                        </div>
                    </div>
                    <div class="indicator-item">
                        <div class="indicator-label">الاتجاه</div>
                        <div class="indicator-value ${this.getIndicatorClass(analysis.accumulationDistribution.trend)}">
                            ${this.getArabicAccumulation(analysis.accumulationDistribution.trend)}
                        </div>
                    </div>
                    <div class="indicator-item">
                        <div class="indicator-label">مؤشر تدفق الأموال</div>
                        <div class="indicator-value ${this.getIndicatorClass(analysis.moneyFlowIndex.flow)}">
                            ${analysis.moneyFlowIndex.value}
                        </div>
                    </div>
                    <div class="indicator-item">
                        <div class="indicator-label">التقلبات</div>
                        <div class="indicator-value ${analysis.volatility > 10 ? 'indicator-negative' : 'indicator-positive'}">
                            ${analysis.volatility.toFixed(2)}%
                        </div>
                    </div>
                </div>
            </div>

            <div class="analysis-section">
                <div class="analysis-title">
                    <i class="fas fa-bullseye"></i> الأهداف والدعوم
                </div>
                <div class="targets-section">
                    <div class="target-item">
                        <div class="indicator-label">الهدف الأول</div>
                        <div class="indicator-value">$${analysis.supportResistance.resistance1.toFixed(6)}</div>
                    </div>
                    <div class="target-item">
                        <div class="indicator-label">الهدف الثاني</div>
                        <div class="indicator-value">$${analysis.supportResistance.resistance2.toFixed(6)}</div>
                    </div>
                    <div class="target-item support-item">
                        <div class="indicator-label">الدعم الأول</div>
                        <div class="indicator-value">$${analysis.supportResistance.support1.toFixed(6)}</div>
                    </div>
                    <div class="target-item support-item">
                        <div class="indicator-label">الدعم الثاني</div>
                        <div class="indicator-value">$${analysis.supportResistance.support2.toFixed(6)}</div>
                    </div>
                </div>
            </div>

            <div class="analysis-section">
                <div class="analysis-title">
                    <i class="fas fa-sign-in-alt"></i> استراتيجية التداول المتكيفة
                </div>
                <div class="targets-section">
                    <div class="target-item entry-point">
                        <div class="indicator-label">نقطة الدخول المثلى</div>
                        <div class="indicator-value">$${analysis.entryPoint.price}</div>
                    </div>
                    <div class="target-item entry-point">
                        <div class="indicator-label">مستوى الثقة</div>
                        <div class="indicator-value">${this.getArabicConfidence(analysis.entryPoint.confidence)}</div>
                    </div>
                    <div class="target-item entry-point">
                        <div class="indicator-label">الاستراتيجية</div>
                        <div class="indicator-value">${analysis.entryPoint.strategy}</div>
                    </div>
                    <div class="target-item support-item">
                        <div class="indicator-label">وقف الخسارة</div>
                        <div class="indicator-value">$${analysis.stopLoss.price}</div>
                    </div>
                    <div class="target-item support-item">
                        <div class="indicator-label">نسبة المخاطرة</div>
                        <div class="indicator-value">${analysis.stopLoss.percentage}%</div>
                    </div>
                    <div class="target-item support-item">
                        <div class="indicator-label">نوع وقف الخسارة</div>
                        <div class="indicator-value">${analysis.stopLoss.type}</div>
                    </div>
                </div>
            </div>

            <div class="analysis-section">
                <div class="analysis-title">
                    <i class="fas fa-brain"></i> تحليل السوق الذكي
                </div>
                <div style="background: rgba(0, 212, 255, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #00d4ff;">
                    ${this.generateMarketAnalysis(coin)}
                </div>
            </div>

            <div class="analysis-section">
                <div class="analysis-title">
                    <i class="fas fa-lightbulb"></i> التوصية الاحترافية المتكيفة
                </div>
                <div style="background: rgba(0, 212, 255, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #00d4ff;">
                    ${this.generateAdaptiveRecommendation(coin)}
                </div>
            </div>
        `;
    }

    generateMarketAnalysis(coin) {
        const regimeAnalysis = {
            bull: `
                <strong style="color: #00ff88;">🚀 السوق في حالة صعود</strong><br>
                • الزخم الإيجابي يدعم الارتفاعات<br>
                • فرص جيدة للمضاربة قصيرة المدى<br>
                • التقلبات: ${this.getVolatilityText()}<br>
                • استراتيجية: ${coin.analysis.entryPoint.strategy}
            `,
            bear: `
                <strong style="color: #ff4757;">🐻 السوق في حالة هبوط</strong><br>
                • الحذر مطلوب في جميع الصفقات<br>
                • البحث عن إشارات انعكاس قوية<br>
                • التقلبات: ${this.getVolatilityText()}<br>
                • استراتيجية: ${coin.analysis.entryPoint.strategy}
            `,
            sideways: `
                <strong style="color: #ffd700;">⚡ السوق في حالة تذبذب</strong><br>
                • فرص جيدة للتداول على المدى القصير<br>
                • استغلال الدعوم والمقاومات<br>
                • التقلبات: ${this.getVolatilityText()}<br>
                • استراتيجية: ${coin.analysis.entryPoint.strategy}
            `
        };
        
        return regimeAnalysis[this.marketRegime] || 'تحليل عام للسوق';
    }

    generateAdaptiveRecommendation(coin) {
        const analysis = coin.analysis;
        let recommendation = '';
        
        // تحديد التوصية الأساسية حسب النقاط
        if (coin.score >= 80) {
            recommendation = `<strong style="color: #00ff88;">توصية قوية بالشراء 🚀</strong><br>`;
        } else if (coin.score >= 60) {
            recommendation = `<strong style="color: #ffd700;">توصية متوسطة 📊</strong><br>`;
        } else {
            recommendation = `<strong style="color: #ff4757;">تحذير - لا يُنصح بالشراء ⚠️</strong><br>`;
        }
        
        // تخصيص التوصية حسب نظام السوق
        switch (this.marketRegime) {
            case 'bull':
                if (coin.score >= 70) {
                    recommendation += `
                        العملة تظهر إشارات قوية في السوق الصاعد. الزخم الإيجابي يدعم الارتفاع.
                        <br><strong>خطة العمل:</strong>
                                               <br>• دخول تدريجي عند ${analysis.entryPoint.price}$
                        <br>• وقف الخسارة عند ${analysis.stopLoss.price}$ (${analysis.stopLoss.percentage}%)
                        <br>• الهدف الأول: ${analysis.supportResistance.resistance1.toFixed(6)}$
                        <br>• الهدف الثاني: ${analysis.supportResistance.resistance2.toFixed(6)}$
                        <br>• ${analysis.stopLoss.type}
                    `;
                } else {
                    recommendation += `
                        رغم السوق الصاعد، العملة تحتاج لمراقبة إضافية.
                        <br>• انتظار تحسن المؤشرات الفنية
                        <br>• مراقبة كسر المقاومات
                    `;
                }
                break;
                
            case 'bear':
                if (coin.score >= 75) {
                    recommendation += `
                        العملة تظهر مقاومة جيدة في السوق الهابط وقد تكون فرصة للانعكاس.
                        <br><strong>خطة العمل الحذرة:</strong>
                        <br>• انتظار إشارات انعكاس أقوى
                        <br>• دخول محدود عند ${analysis.entryPoint.price}$
                        <br>• وقف خسارة ضيق عند ${analysis.stopLoss.price}$ (${analysis.stopLoss.percentage}%)
                        <br>• ${analysis.stopLoss.type}
                    `;
                } else {
                    recommendation += `
                        في السوق الهابط، هذه العملة تحمل مخاطر عالية.
                        <br>• تجنب الدخول حالياً
                        <br>• انتظار استقرار السوق
                    `;
                }
                break;
                
            case 'sideways':
                if (coin.score >= 65) {
                    recommendation += `
                        فرصة جيدة للتداول في السوق المتذبذب.
                        <br><strong>استراتيجية التذبذب:</strong>
                        <br>• شراء عند الدعم ${analysis.supportResistance.support1.toFixed(6)}$
                        <br>• بيع عند المقاومة ${analysis.supportResistance.resistance1.toFixed(6)}$
                        <br>• وقف الخسارة تحت ${analysis.stopLoss.price}$
                        <br>• ${analysis.stopLoss.type}
                    `;
                } else {
                    recommendation += `
                        العملة لا تظهر إشارات واضحة في السوق المتذبذب.
                        <br>• البحث عن فرص أفضل
                        <br>• مراقبة كسر الدعوم أو المقاومات
                    `;
                }
                break;
        }
        
        // إضافة تحذيرات المخاطر
        recommendation += `
            <br><br><strong style="color: #ff6b6b;">⚠️ تحذيرات المخاطر:</strong>
            <br>• لا تستثمر أكثر مما يمكنك تحمل خسارته
            <br>• استخدم إدارة رأس المال (لا تزيد عن 2-3% من المحفظة)
            <br>• راقب الأخبار والتطورات التقنية
            <br>• هذا التحليل ليس نصيحة مالية شخصية
        `;
        
        return recommendation;
    }

    getVolatilityText() {
        switch (this.marketVolatility) {
            case 'high': return 'عالية ⚡';
            case 'medium': return 'متوسطة 📊';
            case 'low': return 'منخفضة 🔒';
            default: return 'غير محددة';
        }
    }

    getIndicatorClass(value) {
        if (typeof value === 'string') {
            if (['bullish', 'buy', 'positive', 'high', 'increasing', 'accumulation'].includes(value)) {
                return 'indicator-positive';
            } else if (['bearish', 'sell', 'negative', 'low', 'decreasing', 'distribution'].includes(value)) {
                return 'indicator-negative';
            }
        }
        return 'indicator-neutral';
    }

    getArabicSignal(signal) {
        const signals = {
            'buy': 'شراء',
            'sell': 'بيع',
            'bullish': 'صاعد',
            'bearish': 'هابط',
            'neutral': 'محايد',
            'overbought': 'مشترى بإفراط',
            'oversold': 'مباع بإفراط',
            'above_zero': 'فوق الصفر',
            'below_zero': 'تحت الصفر'
        };
        return signals[signal] || signal;
    }

    getArabicStrength(strength) {
        const strengths = {
            'high': 'قوية',
            'medium': 'متوسطة',
            'low': 'ضعيفة'
        };
        return strengths[strength] || strength;
    }

    getArabicCrossover(crossover) {
        const crossovers = {
            'bullish': 'تقاطع صاعد',
            'bearish': 'تقاطع هابط'
        };
        return crossovers[crossover] || crossover;
    }

    getArabicAccumulation(trend) {
        const trends = {
            'accumulation': 'تجميع',
            'distribution': 'تصريف'
        };
        return trends[trend] || trend;
    }

    getArabicConfidence(confidence) {
        const confidences = {
            'high': 'عالية 🔥',
            'medium': 'متوسطة 📊',
            'low': 'منخفضة ⚠️'
        };
        return confidences[confidence] || confidence;
    }

    closeModal() {
        const modal = document.getElementById('modalOverlay');
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    updateLastUpdate() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const dateString = now.toLocaleDateString('ar-SA');
        
        document.getElementById('lastUpdate').textContent = `آخر تحديث: ${dateString} - ${timeString}`;
    }

    showLoading() {
        const grid = document.getElementById('coinsGrid');
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 50px;">
                <div class="loading-spinner"></div>
                <p style="margin-top: 20px; font-size: 1.2rem;">جاري تحليل العملات الرقمية...</p>
                <p style="opacity: 0.7;">يتم تحليل البيانات وتطبيق الخوارزميات المتقدمة</p>
            </div>
        `;
    }

    showError(message) {
        const grid = document.getElementById('coinsGrid');
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 50px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ff4757; margin-bottom: 20px;"></i>
                <p style="font-size: 1.2rem; color: #ff4757; margin-bottom: 10px;">حدث خطأ في تحميل البيانات</p>
                <p style="opacity: 0.7;">${message}</p>
                <button onclick="detector.fetchData()" style="margin-top: 20px; padding: 10px 20px; background: #00d4ff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    <i class="fas fa-redo"></i> إعادة المحاولة
                </button>
            </div>
        `;
    }

    // دالة لتحديث البيانات تلقائياً
    startAutoUpdate() {
        // تحديث كل 5 دقائق
        setInterval(() => {
            this.fetchData();
        }, 300000);
    }

    // دالة لحفظ الإعدادات في التخزين المحلي
    saveSettings() {
        const settings = {
            currentFilter: this.currentFilter,
            marketRegime: this.marketRegime,
            marketVolatility: this.marketVolatility
        };
        localStorage.setItem('cryptoDetectorSettings', JSON.stringify(settings));
    }

    // دالة لتحميل الإعدادات من التخزين المحلي
    loadSettings() {
        const saved = localStorage.getItem('cryptoDetectorSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            this.currentFilter = settings.currentFilter || 'all';
            this.marketRegime = settings.marketRegime || 'sideways';
            this.marketVolatility = settings.marketVolatility || 'medium';
            
            // تحديث واجهة المستخدم
            document.getElementById('filterSelect').value = this.currentFilter;
        }
    }

    // دالة لإضافة العملة للمفضلة
    addToFavorites(symbol) {
        let favorites = JSON.parse(localStorage.getItem('cryptoFavorites') || '[]');
        if (!favorites.includes(symbol)) {
            favorites.push(symbol);
            localStorage.setItem('cryptoFavorites', JSON.stringify(favorites));
        }
    }

    // دالة لإزالة العملة من المفضلة
    removeFromFavorites(symbol) {
        let favorites = JSON.parse(localStorage.getItem('cryptoFavorites') || '[]');
        favorites = favorites.filter(fav => fav !== symbol);
        localStorage.setItem('cryptoFavorites', JSON.stringify(favorites));
    }

    // دالة للحصول على المفضلة
    getFavorites() {
        return JSON.parse(localStorage.getItem('cryptoFavorites') || '[]');
    }
}

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    window.detector = new CryptoPumpDetector();
    
    // إعداد أحداث واجهة المستخدم
    document.getElementById('refreshBtn').addEventListener('click', () => {
        detector.fetchData();
    });
    
    document.getElementById('filterSelect').addEventListener('change', (e) => {
        detector.currentFilter = e.target.value;
        detector.filterCoins();
        detector.saveSettings();
    });
    
    document.getElementById('closeModal').addEventListener('click', () => {
        detector.closeModal();
    });
    
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlay') {
            detector.closeModal();
        }
    });
    
    // إضافة دعم لوحة المفاتيح
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            detector.closeModal();
        }
        if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
            e.preventDefault();
            detector.fetchData();
        }
    });
    
    // بدء التحديث التلقائي
    detector.startAutoUpdate();
    
    // تحميل الإعدادات المحفوظة
    detector.loadSettings();
    
    // بدء تحميل البيانات
    detector.fetchData();
});

// إضافة دعم للوضع المظلم
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
}

// تحميل إعدادات الوضع المظلم
document.addEventListener('DOMContentLoaded', function() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
    }
});

// دالة لتصدير البيانات
function exportData() {
    if (window.detector && window.detector.coins.length > 0) {
        const dataStr = JSON.stringify(window.detector.coins, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `crypto-analysis-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }
}

// دالة لطباعة التقرير
function printReport() {
    window.print();
}

// إضافة دعم للإشعارات
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function showNotification(title, body, icon = '/favicon.ico') {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: icon,
            tag: 'crypto-alert'
        });
    }
}

// تصدير الكلاس للاستخدام العام
window.CryptoPumpDetector = CryptoPumpDetector;

