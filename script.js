// Financial Command Center v2025.06.18.5
// State Management
const state = {
    debts: [
        { id: 1, name: 'IRS 2022', balance: 10066, rate: 0.07, minPayment: 124.58, originalBalance: 10066 },
        { id: 2, name: 'IRS 2023', balance: 13153, rate: 0.07, minPayment: 124.58, originalBalance: 13153 },
        { id: 3, name: 'IRS 2024', balance: 33814, rate: 0.07, minPayment: 124.84, originalBalance: 33814 },
        { id: 4, name: 'Chase Card', balance: 17968, rate: 0.2924, minPayment: 538, originalBalance: 17968 }
    ],
    quarterlyTaxGoal: 9566,
    quarterlyPaid: 0,
    strategy: 'snowball',
    defaultSplits: {
        tithe: 10,
        tax: 22.9,
        debt: 30,
        flexible: 37.1
    },
    pauseTaxReserve: false,
    thresholds: {
        usePercentage: false,
        interestWarning: 500,
        interestBad: 800
    },
    irsOverrides: {
        'Q1 2025': null,
        'Q2 2025': null,
        'Q3 2025': null,
        'Q4 2025': null
    },
    incomeHistory: [],
    paymentHistory: [],
    activityLog: [],
    totalInterestPaid: 0,
    currentEditingIncomeId: null,
    currentEditingPaymentId: null,
    currentEditingDebtId: null,
    debtSort: { column: 'balance', ascending: true }
};
function renderDebtSubtotal(tbody, debts, label) {
 console.log(`🧾 Subtotal triggered for ${label}`, debts);
  
  const totals = debts.reduce((a, d) => {
    a.balance += d.balance;
    a.min += d.minPayment;
    a.int += d.balance * d.rate / 12;
    return a;
  }, { balance: 0, min: 0, int: 0 });

  const row = document.createElement('tr');
  row.className = `debt-subtotal-row ${label.toLowerCase()}-total`;
  row.innerHTML = `
    <td style="text-align:right;"><strong>${label} Total:</strong></td>
    <td class="negative"><strong>${formatCurrency(totals.balance)}</strong></td>
    <td></td>
    <td><strong>${formatCurrency(totals.min)}</strong></td>
    <td class="negative"><strong>${formatCurrency(totals.int)}</strong></td>
    <td></td>
    <td></td>
  `;
   console.log('🛠️ About to append subtotal row:', row.outerHTML);
  tbody.appendChild(row);
}

// Motivational quotes with attributions
const motivationalQuotes = [
    { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
    { text: "A journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
    { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
    { text: "Financial freedom is freedom from fear.", author: "Robert Kiyosaki" },
    { text: "Every dollar you pay off is a dollar working for you, not against you.", author: "Unknown" },
    { text: "Compound interest is the eighth wonder of the world. He who understands it, earns it; he who doesn't, pays it.", author: "Albert Einstein" },
    { text: "Being debt-free is worth more than any luxury purchase.", author: "Dave Ramsey" },
    { text: "Your future self will thank you for the sacrifices you make today.", author: "Unknown" }
];

// Charts
let payoffChart = null;
let chartInitialized = false;

// Debounce timers
let defaultSplitTimer = null;
let thresholdsTimer = null;

// Initialize
function init() {
    try {
        loadState();
        
        // Remove Pinnacle if it exists (it's a checking account)
        state.debts = state.debts.filter(d => !d.name.toLowerCase().includes('pinnacle'));
        
        // Initialize charts after a delay to ensure Chart.js is loaded
        setTimeout(() => {
            initCharts();
            updateAllCalculations();
            updateTaxWarning();
            updateMacroSummary();
        }, 100);
        
        // Set default split values
        document.getElementById('defaultTithe').value = state.defaultSplits.tithe;
        document.getElementById('defaultTax').value = state.defaultSplits.tax;
        document.getElementById('defaultDebt').value = state.defaultSplits.debt;
        document.getElementById('defaultFlexible').value = state.defaultSplits.flexible;
        
        // Set threshold values
        document.getElementById('usePercentageColors').value = state.thresholds.usePercentage ? 'true' : 'false';
        document.getElementById('interestThresholdWarning').value = state.thresholds.interestWarning;
        document.getElementById('interestThresholdBad').value = state.thresholds.interestBad;
        
        // Set pause tax reserve
        if (state.pauseTaxReserve !== undefined) {
            document.getElementById('pauseTaxReserve').checked = state.pauseTaxReserve;
        }
        
        // Initialize settings preview
        updateSettingsPreview();
        
        // Set IRS overrides
        if (state.irsOverrides) {
            document.getElementById('irsOverrideQ1').value = state.irsOverrides['Q1 2025'] || '';
            document.getElementById('irsOverrideQ2').value = state.irsOverrides['Q2 2025'] || '';
            document.getElementById('irsOverrideQ3').value = state.irsOverrides['Q3 2025'] || '';
            document.getElementById('irsOverrideQ4').value = state.irsOverrides['Q4 2025'] || '';
        }
        
        // Set up checkbox listener
        document.getElementById('useDefaultSplit').addEventListener('change', function() {
            document.getElementById('customSplitEditor').style.display = 
                this.checked ? 'none' : 'block';
            
            // Update custom tax based on income type
            if (!this.checked) {
                updateCustomTaxBasedOnType();
            }
        });
        
        // Set up income type listener
        document.getElementById('incomeType').addEventListener('change', function() {
            updateCustomTaxBasedOnType();
        });
        
        // Set up defer tax checkbox listener
        document.getElementById('deferTaxReserve').addEventListener('change', function() {
            const incomeType = document.getElementById('incomeType').value;
            if (this.checked && (incomeType === 'commission' || incomeType === 'override' || incomeType === 'other-1099')) {
                console.log('Tax reserve will be deferred for this 1099 income');
            }
        });
        
        // Set up custom split listeners
        ['customTithe', 'customTax', 'customDebt'].forEach(id => {
            document.getElementById(id).addEventListener('input', updateCustomFlexible);
        });
        
        // Set up edit modal split listeners
        ['editTithe', 'editTax', 'editDebt'].forEach(id => {
            document.getElementById(id).addEventListener('input', updateEditFlexible);
        });
        
        // Set up edit modal override checkbox listener
        document.getElementById('editOverrideDebtReduction').addEventListener('change', function() {
            document.getElementById('editOverrideReasonGroup').style.display = 
                this.checked ? 'block' : 'none';
        });
        
        // Set today's date for payment forms
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('debtPaymentDate').value = today;
        document.getElementById('taxPaymentDate').value = today;
        
        // Populate debt selects
        updateDebtSelects();
        
        console.log('Financial Command Center initialized successfully');
        
        // Update last saved time if available
        const lastSaved = localStorage.getItem('financialStateLastSaved');
        if (lastSaved) {
            const lastSavedEl = document.getElementById('lastSaved');
            if (lastSavedEl) {
                lastSavedEl.textContent = lastSaved;
            }
        }
        
        // Update last user save time if available
        const lastUserSave = localStorage.getItem('financialStateLastUserSave');
        if (lastUserSave) {
            const lastUserSaveEl = document.getElementById('lastUserSave');
            if (lastUserSaveEl) {
                lastUserSaveEl.textContent = lastUserSave;
            }
        }
        
    } catch (error) {
        console.error('Error during initialization:', error);
        alert('There was an error loading your financial data. The app will continue with default settings.');
        
        // Try to continue with defaults
        try {
            resetToDefaults();
            updateAllCalculations();
        } catch (secondaryError) {
            console.error('Critical error - unable to initialize:', secondaryError);
            alert('Critical error loading the application. Please refresh the page.');
        }
    }
}

// Toggle override reason field
function toggleOverrideReason() {
    const checkbox = document.getElementById('overrideDebtReduction');
    const controls = document.getElementById('overrideControls');
    
    if (checkbox.checked) {
        controls.classList.add('active');
    } else {
        controls.classList.remove('active');
        document.getElementById('overrideReason').value = '';
    }
}

// Update custom tax based on income type
function updateCustomTaxBasedOnType() {
    const incomeType = document.getElementById('incomeType').value;
    const customTaxInput = document.getElementById('customTax');
    
    // Only apply tax to 1099 income types
    if (incomeType === 'commission' || incomeType === 'override' || incomeType === 'other-1099') {
        customTaxInput.value = state.pauseTaxReserve ? 0 : state.defaultSplits.tax;
    } else {
        // W-2 income types should not have tax reserve
        customTaxInput.value = 0;
    }
    
    updateCustomFlexible();
}

// Tab Management
function switchTab(tabName, event) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // If called from quickPayTax, find the correct tab
    if (!event) {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            if (tab.textContent.toLowerCase().includes(tabName.toLowerCase()) ||
                (tabName === 'payments' && tab.textContent.includes('Manual Payments')) ||
                (tabName === 'taxes' && tab.textContent.includes('Quarterly Taxes')) ||
                (tabName === 'log' && tab.textContent.includes('Activity Log'))) {
                tab.classList.add('active');
            }
        });
    } else {
        event.target.classList.add('active');
    }
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Initialize chart when switching to Overview tab (where it now lives)
    if (tabName === 'overview' && !chartInitialized) {
        setTimeout(() => {
            initCharts();
        }, 100);
    }
}

// Load/Save State
function loadState() {
    const saved = localStorage.getItem('financialState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Merge with defaults to handle new properties
            Object.assign(state, parsed);
            
            // Ensure new properties exist
            if (!state.thresholds) {
                state.thresholds = {
                    usePercentage: false,
                    interestWarning: 500,
                    interestBad: 800
                };
            }
            if (!state.thresholds.hasOwnProperty('usePercentage')) {
                state.thresholds.usePercentage = false;
            }
            if (!state.irsOverrides) {
                state.irsOverrides = {
                    'Q1 2025': null,
                    'Q2 2025': null,
                    'Q3 2025': null,
                    'Q4 2025': null
                };
            }
            if (!state.paymentHistory) {
                state.paymentHistory = [];
            }
            if (!state.debtSort) {
                state.debtSort = { column: 'balance', ascending: true };
            }
            if (!state.activityLog) {
                state.activityLog = [];
            }
            if (state.pauseTaxReserve === undefined) {
                state.pauseTaxReserve = false;
            }
            
            // Ensure all debts have originalBalance
            state.debts.forEach(debt => {
                if (!debt.originalBalance) {
                    debt.originalBalance = debt.balance;
                }
            });
            
            // Clean up income history data to prevent errors
            cleanupIncomeData();
            
            // Remove Pinnacle debt if it exists (it's a checking account)
            if (state.debts) {
                state.debts = state.debts.filter(d => !d.name.toLowerCase().includes('pinnacle'));
            }
            
            // Recalculate quarterlyPaid based on 1099 income only
            recalculateQuarterlyTax();
            
        } catch (error) {
            console.error('Error loading saved state:', error);
            // Reset to defaults if data is corrupted
            resetToDefaults();
        }
    }
}

// Recalculate quarterly tax from 1099 income entries
function recalculateQuarterlyTax() {
    state.quarterlyPaid = 0;
    
    // Add up tax amounts from 1099 income only
    state.incomeHistory.forEach(entry => {
        if (entry && (entry.type === 'commission' || entry.type === 'override' || entry.type === 'other-1099') && entry.tax) {
            state.quarterlyPaid += entry.tax;
        }
    });
    
    // Add manual tax payments
    if (state.paymentHistory) {
        state.paymentHistory.forEach(payment => {
            if (payment && payment.type === 'tax' && payment.amount) {
                state.quarterlyPaid += payment.amount;
            }
        });
    }
    
    console.log('Recalculated quarterly tax paid:', state.quarterlyPaid);
}

// Clean up any problematic income data
function cleanupIncomeData() {
    if (!Array.isArray(state.incomeHistory)) {
        state.incomeHistory = [];
        return;
    }
    
    state.incomeHistory = state.incomeHistory.filter(entry => {
        // Remove entries that are completely invalid
        if (!entry || typeof entry !== 'object') {
            console.warn('Removing invalid income entry:', entry);
            return false;
        }
        
        // Fix missing or invalid properties
        if (typeof entry.amount !== 'number' || isNaN(entry.amount)) {
            console.warn('Removing income entry with invalid amount:', entry);
            return false;
        }
        
        // Ensure required properties exist with defaults
        if (!entry.date) {
            entry.date = new Date().toISOString();
        }
        
        if (!entry.type || entry.type === 'undefined' || entry.type === 'null') {
            entry.type = 'other';
        }
        
        if (!entry.splits || typeof entry.splits !== 'object') {
            entry.splits = { tithe: 10, tax: 22.9, debt: 30, flexible: 37.1 };
        }
        
        // Ensure split amounts exist
        if (typeof entry.tithe !== 'number') entry.tithe = entry.amount * 0.1;
        if (typeof entry.tax !== 'number') entry.tax = entry.amount * 0.229;
        if (typeof entry.debt !== 'number') entry.debt = entry.amount * 0.3;
        if (typeof entry.flexible !== 'number') entry.flexible = entry.amount * 0.371;
        
        if (!entry.id) {
            entry.id = Date.now() + Math.random();
        }
        
        // Initialize override fields if missing
        if (entry.overrideDebtReduction === undefined) {
            entry.overrideDebtReduction = false;
        }
        if (entry.overrideReason === undefined) {
            entry.overrideReason = '';
        }
        
        return true;
    });
    
    console.log(`Cleaned up ${state.incomeHistory.length} income entries`);
}

function resetToDefaults() {
    console.warn('Resetting to default state due to data corruption');
    Object.assign(state, {
        debts: [
            { id: 1, name: 'IRS 2022', balance: 10066, rate: 0.07, minPayment: 124.58, originalBalance: 10066 },
            { id: 2, name: 'IRS 2023', balance: 13153, rate: 0.07, minPayment: 124.58, originalBalance: 13153 },
            { id: 3, name: 'IRS 2024', balance: 33814, rate: 0.07, minPayment: 124.84, originalBalance: 33814 },
            { id: 4, name: 'Chase Card', balance: 17968, rate: 0.2924, minPayment: 538, originalBalance: 17968 }
        ],
        quarterlyTaxGoal: 9566,
        quarterlyPaid: 0,
        strategy: 'snowball',
        defaultSplits: {
            tithe: 10,
            tax: 22.9,
            debt: 30,
            flexible: 37.1
        },
        pauseTaxReserve: false,
        thresholds: {
            usePercentage: false,
            interestWarning: 500,
            interestBad: 800
        },
        irsOverrides: {
            'Q1 2025': null,
            'Q2 2025': null,
            'Q3 2025': null,
            'Q4 2025': null
        },
        incomeHistory: [],
        paymentHistory: [],
        activityLog: [],
        totalInterestPaid: 0,
        currentEditingIncomeId: null,
        currentEditingPaymentId: null,
        currentEditingDebtId: null,
        debtSort: { column: 'balance', ascending: true }
    });
}
/* ===== Load from LocalStorage (new) ===== */
function loadState() {
  const saved = localStorage.getItem('financialState');
  if (!saved) return;

  const parsed = JSON.parse(saved);

  // Safeguard required arrays to avoid undefined errors
  parsed.incomeEntries = parsed.incomeEntries || [];
  parsed.debts = parsed.debts || [];
  parsed.expenses = parsed.expenses || [];

  Object.assign(state, parsed);  // non-destructive merge
}
/* ===== END Load ===== */

function saveState() {
    localStorage.setItem('financialState', JSON.stringify(state));
    // Update last saved timestamp
    const timestamp = new Date().toLocaleString();
    localStorage.setItem('financialStateLastSaved', timestamp);
    const lastSavedEl = document.getElementById('lastSaved');
    if (lastSavedEl) {
        lastSavedEl.textContent = timestamp;
    }
}

// Format Currency
function formatCurrency(amount, showSign = false) {
    const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Math.abs(amount));
    
    if (showSign && amount < 0) {
        return '-' + formatted;
    }
    return formatted;
}

// Activity Logging
function logActivity(type, description, amount = null, source = 'User', details = {}) {
    const entry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type,
        description,
        amount,
        source,
        details
    };
    
    if (!state.activityLog) {
        state.activityLog = [];
    }
    
    state.activityLog.unshift(entry);
    
    // Keep only last 500 entries
    if (state.activityLog.length > 500) {
        state.activityLog = state.activityLog.slice(0, 500);
    }
    
    updateActivityLog();
    updateUserSaveTime();
}

function updateActivityLog() {
    const tbody = document.getElementById('activityLog');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    state.activityLog.forEach(entry => {
        const row = document.createElement('tr');
        const date = new Date(entry.timestamp);
        
        // Format details in a human-readable way
        let detailsStr = '';
        if (entry.details && typeof entry.details === 'object') {
            const detailParts = [];
            
            // Format specific detail types
            if (entry.type === 'Income' && entry.details.type) {
                detailParts.push(`Type: ${getIncomeTypeLabel(entry.details.type)}`);
                if (entry.details.notes) detailParts.push(`Notes: ${entry.details.notes}`);
                if (entry.details.overrideDebtReduction) detailParts.push(`Override: ${entry.details.overrideReason || 'Yes'}`);
            } else if (entry.type === 'Payment' && entry.details.account) {
                detailParts.push(`Account: ${entry.details.account}`);
                if (entry.details.remainingBalance !== undefined) {
                    detailParts.push(`Remaining: ${formatCurrency(entry.details.remainingBalance)}`);
                }
            } else if (entry.type === 'Edit' && entry.details.oldAmount !== undefined) {
                detailParts.push(`Changed from: ${formatCurrency(entry.details.oldAmount)}`);
            } else if (entry.type === 'IRS Override') {
                if (entry.details.quarter) detailParts.push(`Quarter: ${entry.details.quarter}`);
                if (entry.details.newBalance !== undefined) {
                    detailParts.push(`New Balance: ${formatCurrency(entry.details.newBalance)}`);
                }
            } else {
                // Generic detail formatting
                for (const [key, value] of Object.entries(entry.details)) {
                    if (value !== null && value !== undefined && key !== 'splits') {
                        if (typeof value === 'number' && key.includes('mount')) {
                            detailParts.push(`${key}: ${formatCurrency(value)}`);
                        } else if (typeof value === 'string' && value.length > 0) {
                            detailParts.push(`${key}: ${value}`);
                        }
                    }
                }
            }
            
            detailsStr = detailParts.join(' • ');
        }
        
        row.innerHTML = `
            <td>${date.toLocaleString()}</td>
            <td>${entry.type}</td>
            <td>${entry.description}</td>
            <td>${entry.amount ? formatCurrency(entry.amount) : '-'}</td>
            <td>${entry.source}</td>
            <td>${detailsStr}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateUserSaveTime() {
    const timestamp = new Date().toLocaleString();
    const lastUserSaveEl = document.getElementById('lastUserSave');
    if (lastUserSaveEl) {
        lastUserSaveEl.textContent = timestamp;
    }
    localStorage.setItem('financialStateLastUserSave', timestamp);
}

function exportActivityLog() {
    const headers = ['Date/Time', 'Type', 'Description', 'Amount', 'Source', 'Details'];
    const rows = state.activityLog.map(entry => [
        new Date(entry.timestamp).toLocaleString(),
        entry.type,
        entry.description,
        entry.amount || '',
        entry.source,
        JSON.stringify(entry.details)
    ]);
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `activity_log_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    
    setTimeout(() => window.URL.revokeObjectURL(url), 100);
}

function clearActivityLog() {
    if (confirm('Clear all activity log entries? This cannot be undone.')) {
        const entriesCount = state.activityLog.length;
        state.activityLog = [];
        
        // Add one entry to show the log was cleared
        logActivity(
            'Clear',
            `Activity log cleared (${entriesCount} entries removed)`,
            null,
            'User',
            {
                entriesCleared: entriesCount,
                clearedAt: new Date().toLocaleString()
            }
        );
        
        saveState();
        updateActivityLog();
    }
}

// Income Recording
function recordIncome(event) {
    event.preventDefault();
    
    const income = parseFloat(document.getElementById('overrideIncome').value);
    const type = document.getElementById('incomeType').value || 'other';
    const notes = document.getElementById('incomeNotes').value;
    const useDefault = document.getElementById('useDefaultSplit').checked;
    const deferTax = document.getElementById('deferTaxReserve').checked;
    const overrideDebtReduction = document.getElementById('overrideDebtReduction').checked;
    const overrideReason = document.getElementById('overrideReason').value;
    
    if (!income || income <= 0) return;
    
    // Validate override reason if override is checked
    if (overrideDebtReduction && !overrideReason.trim()) {
        alert('Please provide a reason for overriding debt reduction');
        return;
    }
    
    // Get splits
    let splits;
    if (useDefault) {
        splits = { ...state.defaultSplits };
        // For W-2 income, don't apply tax reserve
        if (type === 'salary' || type === 'bonus' || type === 'other-w2' || type === 'distribution') {
            splits.tax = 0;
            splits.flexible += state.defaultSplits.tax;
        }
        // If tax reserve is paused for 1099 income
        else if (state.pauseTaxReserve && (type === 'commission' || type === 'override' || type === 'other-1099')) {
            splits.flexible += splits.tax;
            splits.tax = 0;
        }
    } else {
        // PHASE 1 FIX: If deferring tax and this is 1099 income, apply tax to DEBT (not flexible)
        if (deferTax && (type === 'commission' || type === 'override' || type === 'other-1099')) {
            splits.debt += splits.tax;
            splits.tax = 0;
        }

        splits = {
            tithe: parseFloat(document.getElementById('customTithe').value),
            tax: parseFloat(document.getElementById('customTax').value),
            debt: parseFloat(document.getElementById('customDebt').value),
            flexible: parseFloat(document.getElementById('customFlexible').value)
        };
    }
    
    // If deferring tax and this is 1099 income, move tax to flexible
    if (deferTax && (type === 'commission' || type === 'override' || type === 'other-1099')) {
        splits.flexible += splits.tax;
        splits.tax = 0;
    }
    
    // Calculate amounts
    const tithe = income * (splits.tithe / 100);
    const tax = income * (splits.tax / 100);
    const debt = income * (splits.debt / 100);
    const flexible = income * (splits.flexible / 100);
    
    // Track quarterly tax - only for 1099 income types
    if (type === 'commission' || type === 'override' || type === 'other-1099') {
        state.quarterlyPaid += tax;
    }
    
    // Record income history
    const entry = {
        id: Date.now(),
        date: new Date().toISOString(),
        amount: income,
        tithe,
        tax,
        debt,
        flexible,
        type,
        notes,
        splits,
        overrideDebtReduction,
        overrideReason
    };
    
    state.incomeHistory.unshift(entry); // Add to beginning
    
    // Log activity
    logActivity(
        'Income',
        `${getIncomeTypeLabel(type)} income recorded${overrideDebtReduction ? ' (debt override)' : ''}`,
        income,
        'User',
        {
            type,
            splits: `Tithe: ${splits.tithe}%, Tax: ${splits.tax}%, Debt: ${splits.debt}%, Flexible: ${splits.flexible}%`,
            notes,
            overrideDebtReduction,
            overrideReason
        }
    );
    
    // Apply debt payment only if not overridden
    if (!overrideDebtReduction) {
        applyDebtPayment(debt);
    }
    
    // Clear form
    document.getElementById('overrideIncome').value = '';
    document.getElementById('incomeNotes').value = '';
    document.getElementById('useDefaultSplit').checked = true;
    document.getElementById('deferTaxReserve').checked = false;
    document.getElementById('overrideDebtReduction').checked = false;
    document.getElementById('overrideReason').value = '';
    document.getElementById('customSplitEditor').style.display = 'none';
    document.getElementById('overrideControls').classList.remove('active');
    
    // Show success animation
    showSuccessAnimation();
    
    saveState();
    updateAllCalculations();
}

// Income Editing
function editIncome(id) {
    const entry = state.incomeHistory.find(e => e.id === id);
    if (!entry) return;
    
    state.currentEditingIncomeId = id;
    
    // Populate edit form
    document.getElementById('editIncomeAmount').value = entry.amount;
    document.getElementById('editIncomeType').value = entry.type || 'other';
    document.getElementById('editIncomeNotes').value = entry.notes || '';
    document.getElementById('editTithe').value = entry.splits.tithe;
    document.getElementById('editTax').value = entry.splits.tax;
    document.getElementById('editDebt').value = entry.splits.debt;
    document.getElementById('editFlexible').value = entry.splits.flexible;
    document.getElementById('editOverrideDebtReduction').checked = entry.overrideDebtReduction || false;
    document.getElementById('editOverrideReason').value = entry.overrideReason || '';
    
    // Show/hide override reason field
    document.getElementById('editOverrideReasonGroup').style.display = 
        entry.overrideDebtReduction ? 'block' : 'none';
    
    document.getElementById('editIncomeModal').style.display = 'block';
}

function saveIncomeEdit(event) {
    event.preventDefault();
    
    const id = state.currentEditingIncomeId;
    const entry = state.incomeHistory.find(e => e.id === id);
    if (!entry) return;
    
    // Get old values to reverse tax tracking
    const oldTax = entry.tax;
    const oldType = entry.type;
    
    // Get new values
    const newAmount = parseFloat(document.getElementById('editIncomeAmount').value);
    const newType = document.getElementById('editIncomeType').value || 'other';
    const newNotes = document.getElementById('editIncomeNotes').value;
    const newOverrideDebtReduction = document.getElementById('editOverrideDebtReduction').checked;
    const newOverrideReason = document.getElementById('editOverrideReason').value;
    
    // Validate override reason if override is checked
    if (newOverrideDebtReduction && !newOverrideReason.trim()) {
        alert('Please provide a reason for overriding debt reduction');
        return;
    }
    
    const newSplits = {
        tithe: parseFloat(document.getElementById('editTithe').value),
        tax: parseFloat(document.getElementById('editTax').value),
        debt: parseFloat(document.getElementById('editDebt').value),
        flexible: parseFloat(document.getElementById('editFlexible').value)
    };
    
    // Calculate new amounts
    const newTithe = newAmount * (newSplits.tithe / 100);
    const newTax = newAmount * (newSplits.tax / 100);
    const newDebt = newAmount * (newSplits.debt / 100);
    const newFlexible = newAmount * (newSplits.flexible / 100);
    
    // Update tax tracking - only for 1099 income types
    if (oldType === 'commission' || oldType === 'override' || oldType === 'other-1099') {
        state.quarterlyPaid -= oldTax;
    }
    if (newType === 'commission' || newType === 'override' || newType === 'other-1099') {
        state.quarterlyPaid += newTax;
    }
    // Ensure quarterlyPaid doesn't go negative
    state.quarterlyPaid = Math.max(0, state.quarterlyPaid);
    
    // Update entry
    entry.amount = newAmount;
    entry.type = newType;
    entry.notes = newNotes;
    entry.tithe = newTithe;
    entry.tax = newTax;
    entry.debt = newDebt;
    entry.flexible = newFlexible;
    entry.splits = newSplits;
    entry.overrideDebtReduction = newOverrideDebtReduction;
    entry.overrideReason = newOverrideReason;
    
    // Log activity
    logActivity(
        'Edit',
        `${getIncomeTypeLabel(newType)} income entry modified`,
        newAmount,
        'User',
        {
            oldAmount: entry.amount,
            type: newType,
            notes: newNotes,
            overrideDebtReduction: newOverrideDebtReduction,
            overrideReason: newOverrideReason
        }
    );
    
    closeModal('editIncomeModal');
    showSuccessAnimation();
    saveState();
    updateAllCalculations();
}

function updateEditFlexible() {
    const tithe = parseFloat(document.getElementById('editTithe').value) || 0;
    const tax = parseFloat(document.getElementById('editTax').value) || 0;
    const debt = parseFloat(document.getElementById('editDebt').value) || 0;
    const flexible = Math.max(0, 100 - tithe - tax - debt);
    
    document.getElementById('editFlexible').value = flexible.toFixed(1);
}

// Custom Split Management
function updateCustomFlexible() {
    const tithe = parseFloat(document.getElementById('customTithe').value) || 0;
    const tax = parseFloat(document.getElementById('customTax').value) || 0;
    const debt = parseFloat(document.getElementById('customDebt').value) || 0;
    const flexible = Math.max(0, 100 - tithe - tax - debt);
    
    document.getElementById('customFlexible').value = flexible.toFixed(1);
}

function updateDefaultSplits(logChanges = false) {
    const oldSplits = { ...state.defaultSplits };
    
    const tithe = parseFloat(document.getElementById('defaultTithe').value) || 0;
    const tax = parseFloat(document.getElementById('defaultTax').value) || 0;
    const debt = parseFloat(document.getElementById('defaultDebt').value) || 0;
    const flexible = Math.max(0, 100 - tithe - tax - debt);
    
    state.defaultSplits = { tithe, tax, debt, flexible };
    document.getElementById('defaultFlexible').value = flexible.toFixed(1);
    
    // Clear any existing timer
    if (defaultSplitTimer) clearTimeout(defaultSplitTimer);
    
    // Log changes after user stops typing
    defaultSplitTimer = setTimeout(() => {
        const changes = [];
        if (oldSplits.tithe !== tithe) changes.push(`Tithe % changed from ${oldSplits.tithe}% to ${tithe}%`);
        if (oldSplits.tax !== tax) changes.push(`Tax Reserve % changed from ${oldSplits.tax}% to ${tax}%`);
        if (oldSplits.debt !== debt) changes.push(`Debt % changed from ${oldSplits.debt}% to ${debt}%`);
        if (oldSplits.flexible !== flexible) changes.push(`Flexible % changed from ${oldSplits.flexible.toFixed(1)}% to ${flexible.toFixed(1)}%`);
        
        if (changes.length > 0) {
            logActivity(
                'Settings',
                'Default income split percentages updated',
                null,
                'User',
                {
                    changes: changes.join(', '),
                    splits: `Tithe: ${tithe}%, Tax: ${tax}%, Debt: ${debt}%, Flexible: ${flexible.toFixed(1)}%`
                }
            );
        }
        saveState();
    }, 500); // Log after 500ms of no changes
    
    updateSettingsPreview();
}

function updatePauseTaxReserve() {
    const oldValue = state.pauseTaxReserve;
    state.pauseTaxReserve = document.getElementById('pauseTaxReserve').checked;
    
    if (oldValue !== state.pauseTaxReserve) {
        logActivity(
            'Settings',
            state.pauseTaxReserve ? 'Tax Reserve % paused' : 'Tax Reserve % resumed',
            null,
            'User',
            {
                pauseTaxReserve: state.pauseTaxReserve
            }
        );
    }
    
    updateSettingsPreview();
    saveState();
    updateTaxWarning();
}

function updateSettingsPreview() {
    const totalDebt = state.debts.reduce((sum, d) => sum + d.balance, 0);
    const monthlyInterest = state.debts.reduce((sum, d) => sum + (d.balance * d.rate / 12), 0);
    
    const avgMonthlyIncome = calculateAverageMonthlyIncome();
    const debtPercent = state.defaultSplits.debt / 100;
    const monthlyDebtPayment = avgMonthlyIncome * debtPercent;
    const netPayoffRate = monthlyDebtPayment - monthlyInterest;
    
    const months = calculatePayoffMonths(totalDebt, monthlyDebtPayment, monthlyInterest);
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    const timeToFreedom = years > 0 ? `${years} year${years > 1 ? 's' : ''} ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}` : `${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
    
    const previewEl = document.getElementById('settingsPreview');
    if (!previewEl) return;
    
    let previewHTML = `
        <p><strong>Preview with Current Settings:</strong></p>
        <p>With ${state.defaultSplits.debt}% of income going to debt (≈${formatCurrency(monthlyDebtPayment)}/month), `;
    
    if (netPayoffRate > 0) {
        previewHTML += `you would be debt-free in <span style="color: var(--accent-primary);">${timeToFreedom}</span>. `;
        previewHTML += `Your net payoff rate would be <span style="color: var(--accent-positive);">${formatCurrency(netPayoffRate)}/month</span>.`;
    } else {
        previewHTML += `you would need to increase the debt percentage to make progress on principal. `;
        previewHTML += `Current payments would only cover <span style="color: var(--accent-negative);">${formatCurrency(monthlyDebtPayment)}</span> `;
        previewHTML += `of the <span style="color: var(--accent-negative);">${formatCurrency(monthlyInterest)}/month</span> interest.`;
    }
    
    if (state.pauseTaxReserve) {
        previewHTML += `</p><p style="color: var(--accent-warning); margin-top: 12px;">⚠️ Tax reserve is currently paused. The ${state.defaultSplits.tax}% normally reserved for taxes will be allocated to flexible spending instead. Remember to set aside funds for quarterly taxes separately.</p>`;
    }
    
    // Add a note about the preview calculation
    previewHTML += `<p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 12px; font-style: italic;">Note: This preview uses simplified calculations. Actual results may vary based on payment timing and balance changes.</p>`;
    
    previewEl.innerHTML = previewHTML;
}

function updateThresholds() {
    const oldThresholds = { ...state.thresholds };
    
    state.thresholds = {
        usePercentage: document.getElementById('usePercentageColors').value === 'true',
        interestWarning: parseFloat(document.getElementById('interestThresholdWarning').value) || 500,
        interestBad: parseFloat(document.getElementById('interestThresholdBad').value) || 800
    };
    
    // Clear any existing timer
    if (thresholdsTimer) clearTimeout(thresholdsTimer);
    
    // Log changes after user stops typing
    thresholdsTimer = setTimeout(() => {
        if (oldThresholds.usePercentage !== state.thresholds.usePercentage ||
            oldThresholds.interestWarning !== state.thresholds.interestWarning ||
            oldThresholds.interestBad !== state.thresholds.interestBad) {
            logActivity(
                'Settings',
                'Metric status thresholds updated',
                null,
                'User',
                {
                    colorMode: state.thresholds.usePercentage ? 'Percentage-based' : 'Dollar amounts',
                    warningThreshold: formatCurrency(state.thresholds.interestWarning),
                    badThreshold: formatCurrency(state.thresholds.interestBad)
                }
            );
        }
        saveState();
    }, 500);
    
    updateSettingsPreview();
    updateHeaderStatus();
}

function updateIRSOverrides() {
    const oldOverrides = { ...state.irsOverrides };
    
    state.irsOverrides = {
        'Q1 2025': parseFloat(document.getElementById('irsOverrideQ1').value) || null,
        'Q2 2025': parseFloat(document.getElementById('irsOverrideQ2').value) || null,
        'Q3 2025': parseFloat(document.getElementById('irsOverrideQ3').value) || null,
        'Q4 2025': parseFloat(document.getElementById('irsOverrideQ4').value) || null
    };
    
    // Log any changes
    for (const [quarter, newValue] of Object.entries(state.irsOverrides)) {
        if (newValue !== oldOverrides[quarter]) {
            if (newValue !== null) {
                logActivity(
                    'IRS Override',
                    `${quarter} balance manually overridden to ${formatCurrency(newValue)}`,
                    newValue,
                    'User',
                    { quarter, newBalance: newValue, oldBalance: oldOverrides[quarter] }
                );
            } else if (oldOverrides[quarter] !== null) {
                logActivity(
                    'IRS Override',
                    `${quarter} manual override removed`,
                    null,
                    'User',
                    { quarter, oldBalance: oldOverrides[quarter] }
                );
            }
        }
    }
    
    saveState();
    updateQuarterlyTaxes();
    updateTaxWarning();
}

// Income Ledger
function updateIncomeLedger() {
    const tbody = document.getElementById('incomeLedger');
    if (!tbody) {
        console.warn('Income ledger tbody not found');
        return;
    }
    
    tbody.innerHTML = '';
    
    // Safely process each income entry
    state.incomeHistory.forEach(entry => {
        try {
            // Validate entry has required properties
            if (!entry || typeof entry.amount !== 'number' || !entry.date) {
                console.warn('Skipping invalid income entry:', entry);
                return;
            }
            
            const row = document.createElement('tr');
            const date = new Date(entry.date);
            
            // Safely get splits with defaults
            const splits = entry.splits || { tithe: 0, tax: 0, debt: 0, flexible: 0 };
            const safeType = getIncomeTypeLabel(entry.type);
            const safeNotes = entry.notes || '';
            const netAfterSplit = entry.flexible || 0;
            
            // Create override badge if needed
            const overrideBadge = entry.overrideDebtReduction ? 
                `<span class="override-badge" title="${entry.overrideReason || 'Manual debt payment'}">🚫 Override</span>` : '';
            
            row.innerHTML = `
                <td>${date.toLocaleDateString()}</td>
                <td class="positive">${formatCurrency(entry.amount)}${overrideBadge}</td>
                <td>${formatCurrency(entry.tithe || 0)} (${(splits.tithe || 0).toFixed(1)}%)</td>
                <td>${formatCurrency(entry.tax || 0)} (${(splits.tax || 0).toFixed(1)}%)</td>
                <td>${formatCurrency(entry.debt || 0)} (${(splits.debt || 0).toFixed(1)}%)</td>
                <td>${formatCurrency(entry.flexible || 0)} (${(splits.flexible || 0).toFixed(1)}%)</td>
                <td class="positive">${formatCurrency(netAfterSplit)}</td>
                <td>${safeType}</td>
                <td>${safeNotes === '' ? '-' : safeNotes}</td>
                <td>
                    <button onclick="editIncome(${entry.id})" class="edit-btn">✏️</button>
                    <button onclick="deleteIncome(${entry.id})" class="delete-btn">🗑️</button>
                </td>
            `;
if (entry.overrideDebtReduction) {
    row.classList.add('excluded-income');
    row.title = `Excluded: ${entry.overrideReason || "no reason"}${entry.notes ? `\nNotes: ${entry.notes}` : ""}`;
    const typeCell = row.cells[7];
    if (typeCell) {
        const tag = document.createElement('span');
        tag.textContent  = ' 🚫 Excluded';
        tag.style.fontSize = '0.8em';
        tag.style.color    = '#b00';
        typeCell.appendChild(tag);
    }
}

            tbody.appendChild(row);
        } catch (error) {
            console.error('Error creating income ledger row:', error, entry);
        }
    });
}
// === TOGGLE FILTER: Show/Hide Excluded Rows ===
const toggle = document.getElementById('toggleExcluded');
if (toggle && !toggle.dataset.bound) {
    toggle.addEventListener('change', () => {
        const show = toggle.checked;
        document.querySelectorAll('.excluded-income')
                .forEach(row => row.style.display = show ? '' : 'none');
    });
    toggle.dataset.bound = 'true';  // prevents duplicate bindings
}

// Apply toggle state immediately after render
if (toggle && !toggle.checked) {
    document.querySelectorAll('.excluded-income')
            .forEach(row => row.style.display = 'none');
}

function deleteIncome(id) {
    if (confirm('Delete this income entry? This will also reverse any debt payments made from this income.')) {
        const entry = state.incomeHistory.find(e => e.id === id);
        if (entry) {
            // Reverse tax tracking - only for 1099 income types
            if (entry.type === 'commission' || entry.type === 'override' || entry.type === 'other-1099') {
                state.quarterlyPaid = Math.max(0, state.quarterlyPaid - entry.tax);
            }
            
            // Note: Reversing debt payments is complex and would need transaction tracking
            // For now, we'll just remove the entry
            
            state.incomeHistory = state.incomeHistory.filter(e => e.id !== id);
            
            // Log activity
            logActivity(
                'Delete',
                `${getIncomeTypeLabel(entry.type)} income entry removed${entry.overrideDebtReduction ? ' (was override)' : ''}`,
                entry.amount,
                'User',
                {
                    type: getIncomeTypeLabel(entry.type),
                    date: new Date(entry.date).toLocaleDateString(),
                    overrideDebtReduction: entry.overrideDebtReduction,
                    overrideReason: entry.overrideReason
                }
            );
            
            saveState();
            updateAllCalculations();
        }
    }
}

function getIncomeTypeLabel(type) {
    const labels = {
        salary: 'Salary (W-2)',
        commission: 'Commission (1099)',
        override: 'Override (1099)',
        bonus: 'Bonus (W-2)',
        distribution: 'Distribution (K-1)',
        'other-w2': 'Other (W-2)',
        'other-1099': 'Other (1099)'
    };
    
    try {
        // Handle all possible undefined/null/empty cases
        if (type === null || type === undefined || type === '') {
            return 'Other';
        }
        
        // Convert to string and clean up
        const typeStr = String(type).toLowerCase().trim();
        
        // Handle string versions of undefined/null
        if (typeStr === 'undefined' || typeStr === 'null' || typeStr === '') {
            return 'Other';
        }
        
        // Return mapped label or default to 'Other'
        return labels[typeStr] || 'Other';
        
    } catch (error) {
        console.warn('Error in getIncomeTypeLabel:', error, 'type:', type);
        return 'Other';
    }
}

// Manual Payments
function recordDebtPayment(event) {
    event.preventDefault();
    
    const debtId = parseInt(document.getElementById('debtPaymentSelect').value);
    const amount = parseFloat(document.getElementById('debtPaymentAmount').value);
    const date = document.getElementById('debtPaymentDate').value;
    const notes = document.getElementById('debtPaymentNotes').value;
    
    const debt = state.debts.find(d => d.id === debtId);
    if (!debt || amount <= 0) return;
    
    // Apply payment
    debt.balance = Math.max(0, debt.balance - amount);
if (Number.isFinite(debt.balance) && debt.balance === 0) {
    state.debts = state.debts.filter(d => d.id !== debtId);
}
    
    // Record payment history
    state.paymentHistory.unshift({
        id: Date.now(),
        date: date,
        type: 'debt',
        account: debt.name,
        amount: amount,
        notes: notes
    });
    
    // Log activity
    logActivity(
        'Payment',
        `Debt payment of ${formatCurrency(amount)} applied to ${debt.name}`,
        amount,
        'User',
        {
            account: debt.name,
            remainingBalance: debt.balance,
            notes
        }
    );
    
    // Clear form
    event.target.reset();
    document.getElementById('debtPaymentDate').value = new Date().toISOString().split('T')[0];
    
    // Show success animation
    showSuccessAnimation();
    
    saveState();
    updateAllCalculations();
    updateDebtSelects();
}

function recordTaxPayment(event) {
    event.preventDefault();
    
    const amount = parseFloat(document.getElementById('taxPaymentAmount').value);
    const date = document.getElementById('taxPaymentDate').value;
    const quarter = document.getElementById('taxPaymentQuarter').value;
    const notes = document.getElementById('taxPaymentNotes').value;
    
    if (amount <= 0) return;
    
    // Update tax tracking
    state.quarterlyPaid += amount;
    
    // Record payment history
    state.paymentHistory.unshift({
        id: Date.now(),
        date: date,
        type: 'tax',
        account: quarter,
        amount: amount,
        notes: notes
    });
    
    // Log activity
    logActivity(
        'Payment',
        `Quarterly tax payment of ${formatCurrency(amount)} for ${quarter}`,
        amount,
        'User',
        {
            quarter,
            notes
        }
    );
    
    // Clear form
    event.target.reset();
    document.getElementById('taxPaymentDate').value = new Date().toISOString().split('T')[0];
    
    // Show success animation
    showSuccessAnimation();
    
    saveState();
    updateAllCalculations();
}

function updateDebtSelects() {
    const debtSelect = document.getElementById('debtPaymentSelect');
    const targetDebtSelect = document.getElementById('targetDebt');
    
    // Clear options
    debtSelect.innerHTML = '<option value="">Choose debt account...</option>';
    targetDebtSelect.innerHTML = '<option value="">All Debts (Current Strategy)</option>';
    
    // Add debt options
    state.debts.forEach(debt => {
        const option1 = document.createElement('option');
        option1.value = debt.id;
        option1.textContent = `${debt.name} (${formatCurrency(debt.balance)})`;
        debtSelect.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = debt.id;
        option2.textContent = debt.name;
        targetDebtSelect.appendChild(option2);
    });
}

function updatePaymentHistory() {
    const tbody = document.getElementById('paymentHistory');
    tbody.innerHTML = '';
    
    state.paymentHistory.forEach(payment => {
        const row = document.createElement('tr');
        const date = new Date(payment.date);
        
        row.innerHTML = `
            <td>${date.toLocaleDateString()}</td>
            <td>${payment.type === 'debt' ? '🏦 Debt' : '📊 Tax'}</td>
            <td>${payment.account}</td>
            <td class="negative">${formatCurrency(payment.amount)}</td>
            <td>${payment.notes || '-'}</td>
            <td>
                <button onclick="editPayment(${payment.id})" class="edit-btn">✏️</button>
                <button onclick="deletePayment(${payment.id})" class="delete-btn">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function deletePayment(id) {
    if (confirm('Delete this payment record?')) {
        const payment = state.paymentHistory.find(p => p.id === id);
        if (!payment) return;
        
        if (payment.type === 'tax') {
            // Reverse tax tracking
            state.quarterlyPaid = Math.max(0, state.quarterlyPaid - payment.amount);
        }
        
        // Log before deleting
        logActivity(
            'Delete',
            `${payment.type === 'debt' ? 'Debt' : 'Tax'} payment removed`,
            payment.amount,
            'User',
            {
                type: payment.type,
                account: payment.account,
                date: new Date(payment.date).toLocaleDateString()
            }
        );
        
        state.paymentHistory = state.paymentHistory.filter(p => p.id !== id);
        saveState();
        updateAllCalculations();
    }
}

// Payment Editing
function editPayment(id) {
    const payment = state.paymentHistory.find(p => p.id === id);
    if (!payment) return;
    
    state.currentEditingPaymentId = id;
    
    // Populate edit form
    document.getElementById('editPaymentAmount').value = payment.amount;
    document.getElementById('editPaymentDate').value = payment.date;
    document.getElementById('editPaymentNotes').value = payment.notes || '';
    
    // Set up account dropdown based on payment type
    const accountSelect = document.getElementById('editPaymentAccount');
    accountSelect.innerHTML = '';
    
    if (payment.type === 'debt') {
        document.getElementById('editPaymentAccountLabel').textContent = 'Debt Account';
        // Add current debt accounts
        state.debts.forEach(debt => {
            const option = document.createElement('option');
            option.value = debt.name;
            option.textContent = debt.name;
            option.selected = debt.name === payment.account;
            accountSelect.appendChild(option);
        });
    } else {
        document.getElementById('editPaymentAccountLabel').textContent = 'Quarter';
        // Add quarters
        ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'].forEach(quarter => {
            const option = document.createElement('option');
            option.value = quarter;
            option.textContent = quarter;
            option.selected = quarter === payment.account;
            accountSelect.appendChild(option);
        });
    }
    
    document.getElementById('editPaymentModal').style.display = 'block';
}

function savePaymentEdit(event) {
    event.preventDefault();
    
    const id = state.currentEditingPaymentId;
    const payment = state.paymentHistory.find(p => p.id === id);
    if (!payment) return;
    
    // Get old values
    const oldAmount = payment.amount;
    const oldType = payment.type;
    
    // Get new values
    const newAmount = parseFloat(document.getElementById('editPaymentAmount').value);
    const newDate = document.getElementById('editPaymentDate').value;
    const newAccount = document.getElementById('editPaymentAccount').value;
    const newNotes = document.getElementById('editPaymentNotes').value;
    
    // Update tax tracking if it's a tax payment
    if (oldType === 'tax') {
        state.quarterlyPaid = state.quarterlyPaid - oldAmount + newAmount;
        state.quarterlyPaid = Math.max(0, state.quarterlyPaid);
    }
    
    // Update payment
    payment.amount = newAmount;
    payment.date = newDate;
    payment.account = newAccount;
    payment.notes = newNotes;
    
    // Log activity
    logActivity(
        'Edit',
        `${payment.type === 'debt' ? 'Debt' : 'Tax'} payment modified`,
        newAmount,
        'User',
        {
            oldAmount,
            account: newAccount,
            type: payment.type
        }
    );
    
    closeModal('editPaymentModal');
    showSuccessAnimation();
    saveState();
    updateAllCalculations();
}

// Debt Management
function sortDebts(column) {
    // Reset all sort icons
    document.querySelectorAll('.sort-icon').forEach(icon => {
        icon.textContent = '↕';
        icon.parentElement.classList.remove('active');
    });
    
    // Update sort state
    if (state.debtSort.column === column) {
        state.debtSort.ascending = !state.debtSort.ascending;
    } else {
        state.debtSort.column = column;
        state.debtSort.ascending = true;
    }
    
    // Update icon
    const iconEl = document.getElementById(`sort-${column}`);
    iconEl.textContent = state.debtSort.ascending ? '↑' : '↓';
    iconEl.parentElement.classList.add('active');
    
    updateDebtTable();
}

function editDebt(id) {
    const debt = state.debts.find(d => d.id === id);
    if (!debt) return;
    
    state.currentEditingDebtId = id;
    
    // Populate edit form
    document.getElementById('editDebtName').value = debt.name;
    document.getElementById('editDebtBalance').value = debt.balance;
    document.getElementById('editDebtRate').value = debt.rate * 100;
    document.getElementById('editDebtMinPayment').value = debt.minPayment;
    
    document.getElementById('editDebtModal').style.display = 'block';
}

function saveDebtEdit(event) {
    event.preventDefault();
    
    const id = state.currentEditingDebtId;
    const debt = state.debts.find(d => d.id === id);
    if (!debt) return;
    
    // Update debt
    debt.name = document.getElementById('editDebtName').value;
    debt.balance = parseFloat(document.getElementById('editDebtBalance').value);
    debt.rate = parseFloat(document.getElementById('editDebtRate').value) / 100;
    debt.minPayment = parseFloat(document.getElementById('editDebtMinPayment').value);
    
    // Log activity
    logActivity(
        'Edit',
        `Debt account "${debt.name}" updated`,
        debt.balance,
        'User',
        {
            name: debt.name,
            rate: `${(debt.rate * 100).toFixed(2)}%`,
            minPayment: formatCurrency(debt.minPayment)
        }
    );
    
    closeModal('editDebtModal');
    showSuccessAnimation();
    saveState();
    updateAllCalculations();
}

function showAddDebt() {
    document.getElementById('addDebtModal').style.display = 'block';
}

function addDebt(event) {
    event.preventDefault();
    
    const name = document.getElementById('debtName').value;
    const balance = parseFloat(document.getElementById('debtBalance').value);
    const rate = parseFloat(document.getElementById('debtRate').value) / 100;
    const minPayment = parseFloat(document.getElementById('debtMinPayment').value);
    
    const newDebt = {
        id: Date.now(),
        name,
        balance,
        rate,
        minPayment,
        originalBalance: balance
    };
    
    state.debts.push(newDebt);
    
    // Log activity
    logActivity(
        'Add',
        `New debt account "${name}" added with balance ${formatCurrency(balance)}`,
        balance,
        'User',
        {
            name,
            rate: `${(rate * 100).toFixed(2)}%`,
            minPayment: formatCurrency(minPayment)
        }
    );
    
    closeModal('addDebtModal');
    event.target.reset();
    showSuccessAnimation();
    saveState();
    updateAllCalculations();
}

function deleteDebt(id) {
    const debt = state.debts.find(d => d.id === id);
    if (!debt) return;
    
    if (confirm(`Delete ${debt.name}? This cannot be undone.`)) {
        state.debts = state.debts.filter(d => d.id !== id);
        saveState();
        // Log activity
        logActivity(
            'Delete',
            `Debt account "${debt.name}" removed`,
            debt.balance,
            'User',
            {
                name: debt.name,
                originalBalance: debt.originalBalance || debt.balance
            }
        );
        
        saveState();
        updateAllCalculations();
    }
}

// What-If Calculator
function calculateWhatIf() {
    const extraPayment = parseFloat(document.getElementById('extraPayment').value) || 0;
    const targetDebtId = document.getElementById('targetDebt').value;
    
    // Clear target date if using extra payment
    if (extraPayment > 0) {
        document.getElementById('targetDate').value = '';
    }
    
    if (extraPayment <= 0) {
        document.getElementById('whatIfResult').style.display = 'none';
        return;
    }
    
    // Calculate current payoff timeline
    const currentTimeline = calculatePayoffTimeline(0, null);
    const whatIfTimeline = calculatePayoffTimeline(extraPayment, targetDebtId || null);
    
    const monthsSaved = currentTimeline.months - whatIfTimeline.months;
    const interestSaved = currentTimeline.totalInterest - whatIfTimeline.totalInterest;
    
    const result = document.getElementById('whatIfResult');
    result.style.display = 'block';
    result.innerHTML = `
        <h4>Results: Adding ${formatCurrency(extraPayment)}/month</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 12px;">
            <div style="text-align: center;">
                <div style="font-size: 1.2rem; font-weight: 600; color: var(--accent-positive);">
                    ${monthsSaved > 0 ? monthsSaved : 0} months
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">faster payoff</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 1.2rem; font-weight: 600; color: var(--accent-positive);">
                    ${formatCurrency(interestSaved)}
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">interest saved</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 1.2rem; font-weight: 600; color: var(--accent-info);">
                    ${whatIfTimeline.months} months
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">new timeline</div>
            </div>
        </div>
    `;
}

function calculateRequiredPayment() {
    const targetDate = document.getElementById('targetDate').value;
    if (!targetDate) return;
    
    // Clear extra payment if using target date
    document.getElementById('extraPayment').value = '';
    
    const today = new Date();
    const target = new Date(targetDate);
    const monthsAvailable = Math.max(1, (target - today) / (1000 * 60 * 60 * 24 * 30));
    
    // Calculate required monthly payment
    const totalDebt = state.debts.reduce((sum, d) => sum + d.balance, 0);
    const totalMinPayments = state.debts.reduce((sum, d) => sum + d.minPayment, 0);
    
    // Binary search for required payment
    let low = totalMinPayments;
    let high = totalDebt;
    let requiredPayment = 0;
    
    while (high - low > 1) {
        const mid = (low + high) / 2;
        const extraPayment = mid - totalMinPayments;
        const timeline = calculatePayoffTimeline(extraPayment, null);
        
        if (timeline.months <= monthsAvailable) {
            high = mid;
            requiredPayment = mid;
        } else {
            low = mid;
        }
    }
    
    const result = document.getElementById('whatIfResult');
    result.style.display = 'block';
    
    if (requiredPayment > 0) {
        const extraNeeded = requiredPayment - totalMinPayments;
        const timeline = calculatePayoffTimeline(extraNeeded, null);
        
        result.innerHTML = `
            <h4>To be debt-free by ${target.toLocaleDateString()}</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 12px;">
                <div style="text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: 600; color: var(--accent-primary);">
                        ${formatCurrency(requiredPayment)}/month
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">total payment required</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: 600; color: var(--accent-warning);">
                        ${formatCurrency(extraNeeded)}/month
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">extra above minimums</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: 600; color: var(--accent-info);">
                        ${formatCurrency(timeline.totalInterest)}
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">total interest to pay</div>
                </div>
            </div>
        `;
    } else {
        result.innerHTML = `
            <h4>Cannot achieve debt-free by ${target.toLocaleDateString()}</h4>
            <p style="color: var(--text-muted);">The target date is too soon given current debt levels and interest rates.</p>
        `;
    }
}

function calculatePayoffTimeline(extraPayment, targetDebtId) {
    let months = 0;
    let totalInterest = 0;
    let workingDebts = state.debts.map(d => ({...d}));
    const basePayment = getAverageMonthlyDebtPayment();
    
    while (workingDebts.length > 0 && months < 360) {
        months++;
        
        // Add interest
        workingDebts.forEach(debt => {
            const monthlyInterest = debt.balance * debt.rate / 12;
            debt.balance += monthlyInterest;
            totalInterest += monthlyInterest;
        });
        
        // Apply payments
        let availablePayment = basePayment + extraPayment;
        
        // Pay minimums first
        workingDebts.forEach(debt => {
            const minPay = Math.min(debt.minPayment, debt.balance, availablePayment);
            debt.balance -= minPay;
            availablePayment -= minPay;
        });
        
        // Apply extra payment
        if (availablePayment > 0) {
            let target;
            if (targetDebtId) {
                target = workingDebts.find(d => d.id == targetDebtId && d.balance > 0);
            } else {
                // Use current strategy
                const ordered = workingDebts
                    .filter(d => d.balance > 0)
                    .sort((a, b) => {
                        if (state.strategy === 'snowball') return a.balance - b.balance;
                        return b.rate - a.rate;
                    });
                target = ordered[0];
            }
            
            if (target) {
                const payment = Math.min(availablePayment, target.balance);
                target.balance -= payment;
            }
        }
        
        // Remove paid debts
        workingDebts = workingDebts.filter(d => d.balance > 0);
    }
    
    return { months, totalInterest };
}

// Debt Payment Logic
function applyDebtPayment(amount) {
    const orderedDebts = getOrderedDebts();
    let remaining = amount;
    
    // First, pay minimums
    orderedDebts.forEach(debt => {
        if (remaining >= debt.minPayment && debt.balance > 0) {
            const payment = Math.min(debt.minPayment, debt.balance);
            remaining -= payment;
            debt.balance -= payment;
        }
    });
    
    // Then apply extra to target
    if (remaining > 0 && orderedDebts.length > 0) {
        const target = orderedDebts.find(d => d.balance > 0);
        if (target) {
            const payment = Math.min(remaining, target.balance);
            target.balance -= payment;
        }
    }
    
    // Remove paid off debts
state.debts = state.debts.filter(d => Number.isFinite(d.balance) && d.balance > 0);
}

function getOrderedDebts() {
    return [...state.debts].sort((a, b) => {
        if (state.strategy === 'snowball') {
            return a.balance - b.balance;
        } else {
            return b.rate - a.rate;
        }
    });
}

// Get average monthly debt payment (excluding overrides)
function getAverageMonthlyDebtPayment() {
    if (state.incomeHistory.length === 0) return 0;
    
    // Only count entries where debt reduction wasn't overridden
    const nonOverriddenEntries = state.incomeHistory.filter(e => !e.overrideDebtReduction);
    if (nonOverriddenEntries.length === 0) return 0;
    
    const totalDebtPayments = nonOverriddenEntries.reduce((sum, e) => sum + (e.debt || 0), 0);
    const months = Math.max(1, nonOverriddenEntries.length / 4); // Assume 4 income entries per month
    
    return totalDebtPayments / months;
}

// Calculate average monthly income (shared function for consistency)
function calculateAverageMonthlyIncome() {
    if (state.incomeHistory.length === 0) return 2000; // Default for preview
    
    const totalIncome = state.incomeHistory.reduce((sum, e) => sum + (e.amount || 0), 0);
    const months = Math.max(1, state.incomeHistory.length / 4); // Assume 4 income entries per month
    
    return totalIncome / months;
}

// Calculate payoff months (shared function for consistency)
function calculatePayoffMonths(totalDebt, monthlyPayment, monthlyInterest) {
    if (monthlyPayment <= monthlyInterest) return 999;
    
    const netPayoff = monthlyPayment - monthlyInterest;
    return Math.ceil(totalDebt / netPayoff);
}

// Debt Strategy
function setDebtStrategy(strategy) {
    const oldStrategy = state.strategy;
    state.strategy = strategy;
    
    // Update buttons
    if (strategy === 'snowball') {
        document.getElementById('snowballBtn').className = '';
        document.getElementById('avalancheBtn').className = 'secondary';
    } else {
        document.getElementById('snowballBtn').className = 'secondary';
        document.getElementById('avalancheBtn').className = '';
    }
    
    // Log activity
    if (oldStrategy !== strategy) {
        logActivity(
            'Settings',
            `Debt payoff strategy changed to ${strategy === 'snowball' ? 'Snowball (smallest first)' : 'Avalanche (highest rate first)'}`,
            null,
            'User',
            {
                oldStrategy: oldStrategy === 'snowball' ? 'Snowball' : 'Avalanche',
                newStrategy: strategy === 'snowball' ? 'Snowball' : 'Avalanche'
            }
        );
    }
    
    saveState();
    updateDebtTable();
    updatePayoffDates();
}

// Update Calculations
function updateAllCalculations() {
    try {
        const updates = [
            ['Debt Summary', updateDebtSummary],
            ['Tax Status', updateTaxStatus],
            ['Income Summary', updateIncomesSummary],
            ['Debt Table', updateDebtTable],
            ['Income Ledger', updateIncomeLedger],
            ['Payment History', updatePaymentHistory],
            ['Charts', updateCharts],
            ['Payoff Dates', updatePayoffDates],
            ['Header Status', updateHeaderStatus],
            ['Debt Selects', updateDebtSelects],
            ['Quarterly Taxes', updateQuarterlyTaxes],
            ['Tax Warning', updateTaxWarning],
            ['Activity Log', updateActivityLog],
            ['Macro Summary', updateMacroSummary]
        ];
        
        updates.forEach(([name, updateFunction]) => {
            try {
                // Skip chart updates if not initialized
                if (name === 'Charts' && !chartInitialized) {
                    console.log('Skipping chart update - not yet initialized');
                    return;
                }
                updateFunction();
            } catch (error) {
                console.error(`Error updating ${name}:`, error);
            }
        });
        
    } catch (error) {
        console.error('Critical error in updateAllCalculations:', error);
    }
}

function updateMacroSummary() {
    const totalDebt = state.debts.reduce((sum, d) => sum + d.balance, 0);
    const originalTotalDebt = state.debts.reduce((sum, d) => sum + (d.originalBalance || d.balance), 0);
    const debtPaidOff = originalTotalDebt - totalDebt;
    const debtProgress = originalTotalDebt > 0 ? (debtPaidOff / originalTotalDebt) * 100 : 0;
    
    const totalIncome = state.incomeHistory.reduce((sum, e) => sum + (e.amount || 0), 0);
    const monthlyInterest = state.debts.reduce((sum, d) => sum + (d.balance * d.rate / 12), 0);
    
    const avgMonthlyIncome = calculateAverageMonthlyIncome();
    
    // Calculate excluded amounts
    const excludedEntries = state.incomeHistory.filter(e => e.overrideDebtReduction);
    const totalExcluded = excludedEntries.reduce((sum, e) => sum + (e.debt || 0), 0);
    const excludedCount = excludedEntries.length;
    
    // Calculate months to debt free using consistent method
    const timeline = calculatePayoffTimeline(0, null);
    const monthsToFreedom = timeline.months;
    const years = Math.floor(monthsToFreedom / 12);
    const months = monthsToFreedom % 12;
    const timeToFreedom = years > 0 ? `${years} year${years > 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''}` : `${months} month${months !== 1 ? 's' : ''}`;
    
    const interestOver3Months = monthlyInterest * 3;
    const avgDebtPayment = getAverageMonthlyDebtPayment();
    const netPayoffRate = avgDebtPayment - monthlyInterest;
    
    // Random motivational quote with attribution
    const quoteObj = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
    
    // Build summary
    const summaryEl = document.getElementById('macroSummary');
    if (!summaryEl) return;
    
    let summaryHTML = `
        <p><strong>Current Status:</strong> You are <span style="color: var(--accent-primary);">${timeToFreedom}</span> from being debt-free. `;
    
    if (avgMonthlyIncome > 0) {
        summaryHTML += `You've averaged <span style="color: var(--accent-positive);">${formatCurrency(avgMonthlyIncome)}/month</span> in income. `;
    }
    
    summaryHTML += `With <span style="color: var(--accent-negative);">${formatCurrency(interestOver3Months)}</span> in interest over the next 3 months, `;
    
    if (netPayoffRate > 0) {
        summaryHTML += `your net payoff rate is <span style="color: var(--accent-positive);">${formatCurrency(netPayoffRate)}/month</span>.</p>`;
    } else {
        summaryHTML += `you need to increase payments to make progress on principal.</p>`;
    }
    
    // Add exclusion information if applicable
    if (excludedCount > 0) {
        summaryHTML += `<p><span class="exclusion-badge">🚫 Exclusions:</span> ${excludedCount} income ${excludedCount === 1 ? 'entry' : 'entries'} totaling <span style="color: var(--accent-warning);">${formatCurrency(totalExcluded)}</span> in debt allocation excluded from automatic debt reduction.</p>`;
    }
    
    // Calculate what-if scenario
    const extraNeeded = Math.max(100, monthlyInterest * 0.5); // At least $100 or 50% of interest
    const improvedTimeline = calculatePayoffTimeline(extraNeeded, null);
    const monthsSaved = monthsToFreedom - improvedTimeline.months;
    const newDate = new Date();
    newDate.setMonth(newDate.getMonth() + improvedTimeline.months);
    
    if (monthsSaved > 0) {
        summaryHTML += `<p><strong>Opportunity:</strong> If you increased payments by <span style="color: var(--accent-warning);">${formatCurrency(extraNeeded)}/month</span>, `;
        summaryHTML += `you could be debt-free by <span style="color: var(--accent-info);">${newDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span> `;
        summaryHTML += `(${monthsSaved} months sooner).</p>`;
    }
    
    summaryHTML += `<p style="margin-top: 16px; font-style: italic; color: var(--text-muted);">
        "${quoteObj.text}" — <em>${quoteObj.author}</em>
    </p>`;
    
    summaryEl.innerHTML = summaryHTML;
}

function updateDebtSummary() {
    const totalDebt = state.debts.reduce((sum, d) => sum + d.balance, 0);
    const totalRate = state.debts.reduce((sum, d) => sum + d.balance * d.rate, 0);
    const avgRate = totalDebt > 0 ? totalRate / totalDebt : 0;
    const monthlyInterest = totalDebt * avgRate / 12;
    
    document.getElementById('totalDebt').textContent = formatCurrency(totalDebt);
    document.getElementById('debtCount').textContent = state.debts.length;
    document.getElementById('avgRate').textContent = (avgRate * 100).toFixed(1) + '%';
    document.getElementById('dailyInterest').textContent = formatCurrency(monthlyInterest / 30);
    document.getElementById('weeklyInterest').textContent = formatCurrency(monthlyInterest / 4.33);
    document.getElementById('monthlyInterest').textContent = formatCurrency(monthlyInterest);
}

function updateTaxStatus() {
    const quarterlyGoal = state.quarterlyTaxGoal * 2; // Q1+Q2 combined
    const percent = state.quarterlyPaid > 0 ? (state.quarterlyPaid / quarterlyGoal) * 100 : 0;
    
    document.getElementById('taxStatus').textContent = formatCurrency(state.quarterlyPaid);
    document.getElementById('taxContributed').textContent = formatCurrency(state.quarterlyPaid);
    document.getElementById('taxGoal').textContent = formatCurrency(quarterlyGoal);
    document.getElementById('taxProgressPercent').textContent = percent.toFixed(0) + '%';
    document.getElementById('taxProgress').style.width = Math.min(100, percent) + '%';
    
    // Update progress bar color
    const progressBar = document.getElementById('taxProgress');
    if (percent >= 100) {
        progressBar.className = 'progress-fill';
    } else if (percent >= 50) {
        progressBar.className = 'progress-fill warning';
    } else {
        progressBar.className = 'progress-fill danger';
    }
    
    // Update current quarter info
    const today = new Date();
    const currentQuarter = getQuarter(today);
    const quarterDue = getQuarterDueDate(currentQuarter);
    
    document.getElementById('currentQuarter').textContent = currentQuarter;
    document.getElementById('currentQuarterDue').textContent = quarterDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Calculate current quarter tax
    const currentQuarterBalance = getQuarterBalance(currentQuarter);
    document.getElementById('currentQuarterTax').textContent = formatCurrency(currentQuarterBalance);
    
    // Update status message
    const statusEl = document.getElementById('currentQuarterStatus');
    
    if (state.pauseTaxReserve) {
        statusEl.innerHTML = `<span style="color: var(--accent-warning);">⚠️ Tax reserve paused - set aside funds manually</span>`;
    } else if (currentQuarterBalance > 0) {
        const daysUntilDue = Math.ceil((quarterDue - today) / (1000 * 60 * 60 * 24));
        if (daysUntilDue < 0) {
            statusEl.innerHTML = `<span style="color: var(--accent-negative);">⚠️ Overdue by ${Math.abs(daysUntilDue)} days</span>`;
        } else if (daysUntilDue < 30) {
            statusEl.innerHTML = `<span style="color: var(--accent-warning);">⏰ Due in ${daysUntilDue} days</span>`;
        } else {
            statusEl.innerHTML = `<span style="color: var(--text-muted);">📅 Due in ${daysUntilDue} days</span>`;
        }
    } else {
        statusEl.innerHTML = `<span style="color: var(--accent-positive);">✅ Fully paid</span>`;
    }
}

function updateIncomesSummary() {
    const summary = document.getElementById('incomeSummary');
    const totalIncomeEl = document.getElementById('totalIncome');
    const incomeCountEl = document.getElementById('incomeCount');
    
    // Calculate totals by type
    const typeMap = {};
    let grandTotal = 0;
    
    state.incomeHistory.forEach(entry => {
        const type = entry.type || 'other';
        if (!typeMap[type]) {
            typeMap[type] = { count: 0, total: 0 };
        }
        typeMap[type].count++;
        typeMap[type].total += entry.amount || 0;
        grandTotal += entry.amount || 0;
    });
    
    // Update main display
    totalIncomeEl.textContent = formatCurrency(grandTotal);
    incomeCountEl.textContent = state.incomeHistory.length;
    
    // Build type cards
    summary.innerHTML = '';
    const types = ['salary', 'override', 'commission', 'distribution', 'bonus', 'other-w2', 'other-1099'];
    
    types.forEach(type => {
        if (typeMap[type]) {
            const card = document.createElement('div');
            card.className = 'income-type-card';
            card.innerHTML = `
                <div class="income-type-label">${getIncomeTypeLabel(type)}</div>
                <div class="income-type-amount">${formatCurrency(typeMap[type].total)}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${typeMap[type].count} entries</div>
            `;
            summary.appendChild(card);
        }
    });
}

function updateDebtTable() {
    console.log('🟡 Entered updateDebtTable...');

    const tbody = document.getElementById('debtTableBody');
    tbody.innerHTML = '';
    
    // Sort debts
    let sortedDebts = [...state.debts];
    const column = state.debtSort.column;
    const ascending = state.debtSort.ascending;
    
    sortedDebts.sort((a, b) => {
        let aVal, bVal;
        
        switch (column) {
            case 'name':
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
                break;
            case 'balance':
                aVal = a.balance;
                bVal = b.balance;
                break;
            case 'rate':
                aVal = a.rate;
                bVal = b.rate;
                break;
            case 'minPayment':
                aVal = a.minPayment;
                bVal = b.minPayment;
                break;
            case 'monthlyInterest':
                aVal = a.balance * a.rate / 12;
                bVal = b.balance * b.rate / 12;
                break;
            default:
                aVal = a.balance;
                bVal = b.balance;
        }
        
        if (aVal < bVal) return ascending ? -1 : 1;
        if (aVal > bVal) return ascending ? 1 : -1;
        return 0;
    });
    
tbody.innerHTML = '';  // clear table

// Bucket debts by name
const buckets = {
  Tax: [],
  Consumer: []
};

state.debts.forEach(d => {
  if (d.name.toLowerCase().includes('irs')) {
    buckets.Tax.push(d);
  } else {
    buckets.Consumer.push(d);
  }
});

['Tax', 'Consumer'].forEach(bucketName => {
  const debts = buckets[bucketName];
  debts.forEach(debt => {
    const monthlyInterest = debt.balance * debt.rate / 12;
    const payoffMonths = debt.minPayment > monthlyInterest
      ? Math.ceil(debt.balance / (debt.minPayment - monthlyInterest))
      : 999;
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + payoffMonths);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${debt.name}</td>
      <td class="negative">${formatCurrency(debt.balance)}</td>
      <td>${(debt.rate * 100).toFixed(2)}%</td>
      <td>${formatCurrency(debt.minPayment)}</td>
      <td class="negative">${formatCurrency(monthlyInterest)}</td>
      <td>${payoffMonths < 999 ? payoffDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Never (min < interest)'}</td>
      <td>
        <button onclick="editDebt(${debt.id})" class="edit-btn">✏️</button>
        <button onclick="deleteDebt(${debt.id})" class="delete-btn">🗑️</button>
      </td>
    `;
      console.log('🧾 Subtotal HTML preview:', row.outerHTML);
    tbody.appendChild(row);
  });

if (debts.length > 0) {
  console.log('🧪 Debts for subtotal check:', debts, 'Bucket:', bucketName);
  renderDebtSubtotal(tbody, debts, bucketName);
} else {
  console.warn(`⚠️ Skipping renderDebtSubtotal: No debts found for bucket "${bucketName}"`);
}

});
console.log('✅ Finished updateDebtTable');
console.log('🔎 Subtotal rows:', document.querySelectorAll('.debt-subtotal-row'));

// === END totals row ========================================

    // === Totals row (NEW) ======================================
    const totals = sortedDebts.reduce(
        (acc, d) => {
            acc.balance    += d.balance;
            acc.minPayment += d.minPayment;
            acc.monthlyInt += d.balance * d.rate / 12;
            return acc;
        },
        { balance: 0, minPayment: 0, monthlyInt: 0 }
    );
    // Remove any existing totals row to prevent duplicates
    const oldTotal = tbody.querySelector('.debt-totals-row');
    if (oldTotal) oldTotal.remove();

    const tRow = document.createElement('tr');
    tRow.className = 'debt-totals-row';
    tRow.innerHTML = `
        <td style="text-align:right;"><strong>Totals:</strong></td>
        <td class="negative"><strong>${formatCurrency(totals.balance)}</strong></td>
        <td></td>
        <td><strong>${formatCurrency(totals.minPayment)}</strong></td>
        <td class="negative"><strong>${formatCurrency(totals.monthlyInt)}</strong></td>
        <td></td>
        <td></td>
    `;
    tbody.appendChild(tRow);
    // === END totals row ========================================
    
}

function updatePayoffDates() {
    const timeline = calculatePayoffTimeline(0, null);
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + timeline.months);
    
    const payoffDateEl = document.getElementById('payoffDateHeader');
    if (timeline.months < 999) {
        payoffDateEl.textContent = payoffDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } else {
        payoffDateEl.textContent = 'Never';
    }
}

function updateHeaderStatus() {
    const totalDebt = state.debts.reduce((sum, d) => sum + d.balance, 0);
    const originalTotalDebt = state.debts.reduce((sum, d) => sum + (d.originalBalance || d.balance), 0);
    const monthlyInterest = state.debts.reduce((sum, d) => sum + (d.balance * d.rate / 12), 0);
    
    // Update total debt pill
    const debtPill = document.getElementById('totalDebtPill');
    document.getElementById('totalDebtHeader').textContent = formatCurrency(totalDebt);
    
    if (state.thresholds.usePercentage) {
        // Percentage-based coloring
        const percentPaid = originalTotalDebt > 0 ? ((originalTotalDebt - totalDebt) / originalTotalDebt) * 100 : 0;
        if (percentPaid >= 50) {
            debtPill.className = 'stat-pill status-good';
        } else if (percentPaid >= 25) {
            debtPill.className = 'stat-pill status-warning';
        } else {
            debtPill.className = 'stat-pill status-bad';
        }
    } else {
        // Dollar-based coloring
        if (totalDebt < 30000) {
            debtPill.className = 'stat-pill status-good';
        } else if (totalDebt < 50000) {
            debtPill.className = 'stat-pill status-warning';
        } else {
            debtPill.className = 'stat-pill status-bad';
        }
    }
    
    // Update monthly interest pill
    const interestPill = document.getElementById('monthlyInterestPill');
    document.getElementById('monthlyInterestHeader').textContent = formatCurrency(monthlyInterest);
    
    if (monthlyInterest < state.thresholds.interestWarning) {
        interestPill.className = 'stat-pill status-good';
    } else if (monthlyInterest < state.thresholds.interestBad) {
        interestPill.className = 'stat-pill status-warning';
    } else {
        interestPill.className = 'stat-pill status-bad';
    }
    
    // Update payoff date pill
    const timeline = calculatePayoffTimeline(0, null);
    const payoffPill = document.getElementById('payoffDatePill');
    
    if (timeline.months < 24) {
        payoffPill.className = 'stat-pill status-good';
    } else if (timeline.months < 48) {
        payoffPill.className = 'stat-pill status-warning';
    } else {
        payoffPill.className = 'stat-pill status-bad';
    }
}

function updateQuarterlyTaxes() {
    const container = document.getElementById('quarterlyBreakdown');
    container.innerHTML = '';
    
    const quarters = ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'];
    const today = new Date();
    const currentQuarter = getQuarter(today);
    
    quarters.forEach(quarter => {
        const card = document.createElement('div');
        card.className = 'quarter-card';
        
        const dueDate = getQuarterDueDate(quarter);
        const balance = getQuarterBalance(quarter);
        const isPaid = balance <= 0;
        const isOverdue = dueDate < today && !isPaid;
        const isCurrent = quarter === currentQuarter;
        
        if (isCurrent) card.classList.add('current');
        if (isOverdue) card.classList.add('overdue');
        
        // Calculate percent to goal
        const quarterGoal = state.quarterlyTaxGoal;
        const quarterPaid = getQuarterPayments(quarter);
        const percentToGoal = quarterGoal > 0 ? (quarterPaid / quarterGoal) * 100 : 0;
        
        let statusClass, statusText;
        if (isPaid) {
            statusClass = 'paid';
            statusText = 'PAID';
        } else if (isOverdue) {
            statusClass = 'overdue';
            statusText = 'OVERDUE';
        } else if (isCurrent) {
            statusClass = 'due';
            statusText = 'DUE SOON';
        } else {
            statusClass = 'not-due';
            statusText = 'NOT DUE';
        }
        
        card.innerHTML = `
            <div class="quarter-status ${statusClass}">${statusText}</div>
            <h3>${quarter}</h3>
            <div class="quarter-details">
                <div class="quarter-detail">
                    <span class="quarter-detail-label">Due Date:</span>
                    <span>${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div class="quarter-detail">
                    <span class="quarter-detail-label">Balance Due:</span>
                    <span class="${balance > 0 ? 'negative' : 'positive'}">${formatCurrency(Math.abs(balance))}</span>
                </div>
                <div class="quarter-detail">
                    <span class="quarter-detail-label">Paid to Date:</span>
                    <span>${formatCurrency(quarterPaid)}</span>
                </div>
                <div class="quarter-detail">
                    <span class="quarter-detail-label">% to Goal:</span>
                    <span style="color: ${percentToGoal >= 100 ? 'var(--accent-positive)' : percentToGoal >= 50 ? 'var(--accent-warning)' : 'var(--accent-negative)'}">
                        ${percentToGoal.toFixed(0)}%
                    </span>
                </div>
            </div>
            ${balance > 0 && isCurrent ? `
                <button onclick="quickPayTax('${quarter}', ${balance})" style="margin-top: 12px; width: 100%;">
                    Pay ${formatCurrency(balance)} Now
                </button>
            ` : ''}
        `;
        
        container.appendChild(card);
    });
    
    // Update tax income breakdown
    updateTaxIncomeBreakdown();
    
    // Update tax payment history
    updateTaxPaymentHistory();
}

function updateTaxIncomeBreakdown() {
    const tbody = document.getElementById('taxIncomeBreakdown');
    tbody.innerHTML = '';
    
    const breakdown = {
        commission: { total: 0, tax: 0, count: 0 },
        override: { total: 0, tax: 0, count: 0 },
        'other-1099': { total: 0, tax: 0, count: 0 }
    };
    
    state.incomeHistory.forEach(entry => {
        if (entry.type === 'commission' || entry.type === 'override' || entry.type === 'other-1099') {
            const type = entry.type;
            breakdown[type].total += entry.amount || 0;
            breakdown[type].tax += entry.tax || 0;
            breakdown[type].count++;
        }
    });
    
    Object.entries(breakdown).forEach(([type, data]) => {
        if (data.count > 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${getIncomeTypeLabel(type)}</td>
                <td>${formatCurrency(data.total)}</td>
                <td>${formatCurrency(data.tax)}</td>
                <td>${data.count}</td>
            `;
            tbody.appendChild(row);
        }
    });
}

function updateTaxPaymentHistory() {
    const tbody = document.getElementById('taxPaymentHistory');
    tbody.innerHTML = '';
    
    const taxPayments = state.paymentHistory.filter(p => p.type === 'tax');
    
    taxPayments.forEach(payment => {
        const row = document.createElement('tr');
        const date = new Date(payment.date);
        
        row.innerHTML = `
            <td>${date.toLocaleDateString()}</td>
            <td>${payment.account}</td>
            <td class="positive">${formatCurrency(payment.amount)}</td>
            <td>${payment.notes || '-'}</td>
            <td>
                <button onclick="editPayment(${payment.id})" class="edit-btn">✏️</button>
                <button onclick="deletePayment(${payment.id})" class="delete-btn">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateTaxWarning() {
    const warningBox = document.getElementById('taxWarningBox');
    const warningContent = document.getElementById('taxWarningContent');
    
    // Don't show warning if tax reserve is paused
    if (state.pauseTaxReserve) {
        warningBox.style.display = 'none';
        return;
    }
    
    // Calculate total unpaid quarterly taxes
    let totalUnpaid = 0;
    const quarters = ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'];
    const today = new Date();
    const overdueQuarters = [];
    
    quarters.forEach(quarter => {
        const balance = getQuarterBalance(quarter);
        const dueDate = getQuarterDueDate(quarter);
        if (balance > 0 && dueDate < today) {
            totalUnpaid += balance;
            overdueQuarters.push({ quarter, balance, dueDate });
        }
    });
    
    if (totalUnpaid > 0) {
        warningBox.style.display = 'block';
        
        let content = `<p>You have <strong>${formatCurrency(totalUnpaid)}</strong> in overdue quarterly taxes:</p><ul>`;
        
        overdueQuarters.forEach(({ quarter, balance, dueDate }) => {
            const daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
            content += `<li>${quarter}: ${formatCurrency(balance)} (${daysOverdue} days overdue)</li>`;
        });
        
        content += `</ul><p>Late quarterly tax payments may incur penalties and interest from the IRS. Estimated costs vary, but failure to pay can lead to accumulating debt. Pay promptly to avoid unnecessary fees.</p>`;
        
        warningContent.innerHTML = content;
    } else {
        warningBox.style.display = 'none';
    }
}

// Quarter Helper Functions
function getQuarter(date) {
    const month = date.getMonth();
    const year = date.getFullYear();
    
    if (month < 3) return `Q1 ${year}`;
    if (month < 6) return `Q2 ${year}`;
    if (month < 9) return `Q3 ${year}`;
    return `Q4 ${year}`;
}

function getQuarterDueDate(quarter) {
    const [q, year] = quarter.split(' ');
    const yearNum = parseInt(year);
    
    switch (q) {
        case 'Q1': return new Date(yearNum, 3, 15); // April 15
        case 'Q2': return new Date(yearNum, 5, 15); // June 15
        case 'Q3': return new Date(yearNum, 8, 15); // September 15
        case 'Q4': return new Date(yearNum + 1, 0, 15); // January 15 next year
        default: return new Date();
    }
}

function getQuarterBalance(quarter) {
    // Check for override first
    if (state.irsOverrides && state.irsOverrides[quarter] !== null) {
        return state.irsOverrides[quarter];
    }
    
    // If tax reserve is paused, return 0 for auto-calculated balances
    if (state.pauseTaxReserve) {
        return 0;
    }
    
    // Calculate based on 1099 income
    let quarterIncome = 0;
    
    state.incomeHistory.forEach(entry => {
        if (entry.type === 'commission' || entry.type === 'override' || entry.type === 'other-1099') {
            const entryDate = new Date(entry.date);
            const entryQuarter = getQuarter(entryDate);
            
            if (entryQuarter === quarter) {
                quarterIncome += entry.amount || 0;
            }
        }
    });
    
    // Calculate tax due (22.9% of 1099 income)
    const taxDue = quarterIncome * 0.229;
    
    // Subtract payments made for this quarter
    const payments = getQuarterPayments(quarter);
    
    return Math.max(0, taxDue - payments);
}

function getQuarterPayments(quarter) {
    let payments = 0;
    
    // Add tax reserve from income entries for this quarter
    state.incomeHistory.forEach(entry => {
        if (entry.type === 'commission' || entry.type === 'override' || entry.type === 'other-1099') {
            const entryDate = new Date(entry.date);
            const entryQuarter = getQuarter(entryDate);
            
            if (entryQuarter === quarter && entry.tax) {
                payments += entry.tax;
            }
        }
    });
    
    // Add manual tax payments for this quarter
    state.paymentHistory.forEach(payment => {
        if (payment.type === 'tax' && payment.account === quarter) {
            payments += payment.amount;
        }
    });
    
    return payments;
}

function quickPayTax(quarter, amount) {
    // Populate the manual payment form and switch to that tab
    document.getElementById('taxPaymentAmount').value = amount;
    document.getElementById('taxPaymentQuarter').value = quarter;
    document.getElementById('taxPaymentNotes').value = `Quick payment for ${quarter}`;
    
    // Log the quick pay initiation
    logActivity(
        'Navigate',
        `Quick pay initiated for ${quarter} - ${formatCurrency(amount)}`,
        amount,
        'User',
        {
            quarter,
            source: 'Quarterly Tax Tab'
        }
    );
    
    switchTab('payments');
}

// Chart Functions
function initCharts() {
    try {
        const ctx = document.getElementById('payoffChart');
        if (!ctx) {
            console.warn('Payoff chart canvas not found');
            return;
        }
        
        payoffChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Projected Debt Balance',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Balance: ' + formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
        
        chartInitialized = true;
        updateCharts();
        
    } catch (error) {
        console.error('Error initializing charts:', error);
    }
}

function updateCharts() {
    if (!chartInitialized || !payoffChart) return;
    
    const months = [];
    const balances = [];
    let workingDebts = state.debts.map(d => ({...d}));
    let currentBalance = workingDebts.reduce((sum, d) => sum + d.balance, 0);
    const monthlyPayment = getAverageMonthlyDebtPayment();
    
    months.push('Today');
    balances.push(currentBalance);
    
    for (let i = 1; i <= 60 && currentBalance > 0; i++) {
        // Apply interest
        workingDebts.forEach(debt => {
            debt.balance += debt.balance * debt.rate / 12;
        });
        
        // Apply payments
        let payment = monthlyPayment;
        
        // Pay minimums first
        workingDebts.forEach(debt => {
            const minPay = Math.min(debt.minPayment, debt.balance, payment);
            debt.balance -= minPay;
            payment -= minPay;
        });
        
        // Apply extra to target debt
        if (payment > 0) {
            const target = workingDebts
                .filter(d => d.balance > 0)
                .sort((a, b) => state.strategy === 'snowball' ? a.balance - b.balance : b.rate - a.rate)[0];
            
            if (target) {
                target.balance -= Math.min(payment, target.balance);
            }
        }
        
        // Remove paid debts
        workingDebts = workingDebts.filter(d => d.balance > 0);
        currentBalance = workingDebts.reduce((sum, d) => sum + d.balance, 0);
        
        if (i % 3 === 0) { // Show every 3 months
            const date = new Date();
            date.setMonth(date.getMonth() + i);
            months.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
            balances.push(currentBalance);
        }
    }
    
    payoffChart.data.labels = months;
    payoffChart.data.datasets[0].data = balances;
    payoffChart.update();
}

// UI Functions
function showSuccessAnimation() {
    // Add a temporary success message
    const successMsg = document.createElement('div');
    successMsg.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--accent-positive);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    successMsg.textContent = '✓ Successfully recorded!';
    document.body.appendChild(successMsg);
    
    setTimeout(() => {
        successMsg.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => successMsg.remove(), 300);
    }, 2000);
}

function editTaxGoal() {
    const currentGoal = state.quarterlyTaxGoal * 2; // Show combined Q1+Q2
    document.getElementById('taxGoalInput').value = currentGoal;
    document.getElementById('editTaxModal').style.display = 'block';
}

function saveTaxGoal(event) {
    event.preventDefault();
    
    const oldGoal = state.quarterlyTaxGoal * 2;
    const newGoal = parseFloat(document.getElementById('taxGoalInput').value);
    state.quarterlyTaxGoal = newGoal / 2; // Store as per-quarter amount
    
    // Log activity
    logActivity(
        'Edit',
        `Quarterly tax goal updated to ${formatCurrency(newGoal)} (Q1+Q2 combined)`,
        newGoal,
        'User',
        {
            oldGoal: formatCurrency(oldGoal),
            newGoal: formatCurrency(newGoal)
        }
    );
    
    closeModal('editTaxModal');
    showSuccessAnimation();
    saveState();
    updateTaxStatus();
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function confirmReset() {
    if (confirm('Reset all income history? This cannot be undone and will reset your tax tracking.')) {
        const totalEntries = state.incomeHistory.length;
        const totalAmount = state.incomeHistory.reduce((sum, e) => sum + (e.amount || 0), 0);
        
        state.incomeHistory = [];
        state.quarterlyPaid = 0;
        state.totalInterestPaid = 0;
        
        // Reset debts to original balances if available
        state.debts.forEach(debt => {
            if (debt.originalBalance) {
                debt.balance = debt.originalBalance;
            }
        });
        
        logActivity(
            'Reset',
            `All income history cleared (${totalEntries} entries totaling ${formatCurrency(totalAmount)})`,
            totalAmount,
            'User',
            {
                entriesCleared: totalEntries,
                totalAmountCleared: formatCurrency(totalAmount)
            }
        );
        
        saveState();
        updateAllCalculations();
    }
}

// Reset All Data function
function resetAllData() {
    document.getElementById('resetDataModal').style.display = 'block';
}

function performResetAllData() {
    // Reset to defaults
    state.debts = [
        { id: 1, name: 'IRS 2022', balance: 10066, rate: 0.07, minPayment: 124.58, originalBalance: 10066 },
        { id: 2, name: 'IRS 2023', balance: 13153, rate: 0.07, minPayment: 124.58, originalBalance: 13153 },
        { id: 3, name: 'IRS 2024', balance: 33814, rate: 0.07, minPayment: 124.84, originalBalance: 33814 },
        { id: 4, name: 'Chase Card', balance: 17968, rate: 0.2924, minPayment: 538, originalBalance: 17968 }
    ];
    state.quarterlyTaxGoal = 9566;
    state.quarterlyPaid = 0;
    state.strategy = 'snowball';
    state.defaultSplits = {
        tithe: 10,
        tax: 22.9,
        debt: 30,
        flexible: 37.1
    };
    state.pauseTaxReserve = false;
    state.thresholds = {
        usePercentage: false,
        interestWarning: 500,
        interestBad: 800
    };
    state.irsOverrides = {
        'Q1 2025': null,
        'Q2 2025': null,
        'Q3 2025': null,
        'Q4 2025': null
    };
    state.incomeHistory = [];
    state.paymentHistory = [];
    state.activityLog = [];
    state.totalInterestPaid = 0;
    
    // Log the reset action
    logActivity(
        'Reset',
        'User reset all data to default via Fresh Start',
        null,
        'User',
        {
            action: 'Complete data reset'
        }
    );
    
    closeModal('resetDataModal');
    saveState();
    location.reload(); // Reload to reinitialize everything
}

// Export Functions
function exportIncomeData() {
    const headers = ['Date', 'Amount', 'Tithe', 'Tax', 'Debt', 'Flexible', 'Type', 'Notes', 'Override', 'Override Reason'];
    const rows = state.incomeHistory.map(entry => [
        new Date(entry.date).toLocaleDateString(),
        entry.amount,
        entry.tithe,
        entry.tax,
        entry.debt,
        entry.flexible,
        getIncomeTypeLabel(entry.type),
        entry.notes || '',
        entry.overrideDebtReduction ? 'Yes' : 'No',
        entry.overrideReason || ''
    ]);
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `income_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    
    setTimeout(() => window.URL.revokeObjectURL(url), 100);
}

function exportData() {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `financial_data_${new Date().toISOString().split('T')[0]}.json`);
    link.click();
    
    setTimeout(() => window.URL.revokeObjectURL(url), 100);
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const imported = JSON.parse(e.target.result);
                
                // Validate basic structure
                if (!imported.debts || !Array.isArray(imported.debts)) {
                    throw new Error('Invalid data format');
                }
                
                // Merge with current state
                Object.assign(state, imported);
                
                // Clean up data
                cleanupIncomeData();
                recalculateQuarterlyTax();
                
                saveState();
                location.reload(); // Reload to reinitialize everything
                
            } catch (error) {
                alert('Error importing data: ' + error.message);
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// Initialize on load
window.addEventListener('load', init);
