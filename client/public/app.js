// API Configuration
const API_BASE_URL = window.location.origin + '/api';

// State Management
let currentUser = null;
let todos = [];
let stats = null;

// DOM Elements
const app = document.getElementById('app');
const loading = document.getElementById('loading');

// Utility Functions
const showNotification = (message, type = 'success') => {
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
        warning: 'bg-yellow-500',
        levelup: 'bg-purple-500'
    };

    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg text-white ${colors[type]} glass transition-all duration-300 z-50`;
    notification.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'levelup' ? 'fa-star' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
};

const createParticles = (x, y, color = '#8b5cf6') => {
    for (let i = 0; i < 10; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.setProperty('--offset-x', (Math.random() - 0.5) * 100 + 'px');
        particle.innerHTML = `<i class="fas fa-star text-${color === '#8b5cf6' ? 'purple' : 'yellow'}-400"></i>`;
        document.body.appendChild(particle);
        
        setTimeout(() => particle.remove(), 3000);
    }
};

// API Functions
const api = {
    async register(username, email, password) {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        return response.json();
    },

    async login(username, password) {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        return response.json();
    },

    async getTodos() {
        const response = await fetch(`${API_BASE_URL}/todos`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        return response.json();
    },

    async createTodo(todo) {
        const response = await fetch(`${API_BASE_URL}/todos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(todo)
        });
        return response.json();
    },

    async completeTodo(id) {
        const response = await fetch(`${API_BASE_URL}/todos/${id}/complete`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        return response.json();
    },

    async deleteTodo(id) {
        const response = await fetch(`${API_BASE_URL}/todos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        return response.json();
    },

    async getStats() {
        const response = await fetch(`${API_BASE_URL}/stats`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        return response.json();
    }
};

// Component Functions
const renderAuthForm = () => {
    app.innerHTML = `
        <div class="min-h-screen flex items-center justify-center p-4">
            <div class="glass rounded-2xl p-8 w-full max-w-md">
                <h1 class="text-4xl font-bold text-center mb-8 neon-glow text-purple-400">Epic Quest Todo</h1>
                
                <div id="authForm">
                    <!-- Login Form -->
                    <div id="loginForm">
                        <h2 class="text-2xl font-bold mb-6 text-center">Login to Your Quest</h2>
                        <form onsubmit="handleLogin(event)">
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2">Username or Email</label>
                                <input type="text" name="username" required 
                                    class="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-purple-400 focus:outline-none transition-colors">
                            </div>
                            <div class="mb-6">
                                <label class="block text-sm font-medium mb-2">Password</label>
                                <input type="password" name="password" required 
                                    class="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-purple-400 focus:outline-none transition-colors">
                            </div>
                            <button type="submit" 
                                class="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 font-bold hover:from-purple-600 hover:to-pink-600 transition-all pulse-hover">
                                Start Quest
                            </button>
                        </form>
                        <p class="text-center mt-4 text-sm">
                            New adventurer? 
                            <a href="#" onclick="switchToRegister()" class="text-purple-400 hover:text-purple-300">Create Account</a>
                        </p>
                    </div>
                    
                    <!-- Register Form -->
                    <div id="registerForm" class="hidden">
                        <h2 class="text-2xl font-bold mb-6 text-center">Create Your Hero</h2>
                        <form onsubmit="handleRegister(event)">
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2">Username</label>
                                <input type="text" name="username" required 
                                    class="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-purple-400 focus:outline-none transition-colors">
                            </div>
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2">Email</label>
                                <input type="email" name="email" required 
                                    class="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-purple-400 focus:outline-none transition-colors">
                            </div>
                            <div class="mb-6">
                                <label class="block text-sm font-medium mb-2">Password</label>
                                <input type="password" name="password" required 
                                    class="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-purple-400 focus:outline-none transition-colors">
                            </div>
                            <button type="submit" 
                                class="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 font-bold hover:from-purple-600 hover:to-pink-600 transition-all pulse-hover">
                                Create Hero
                            </button>
                        </form>
                        <p class="text-center mt-4 text-sm">
                            Already have an account? 
                            <a href="#" onclick="switchToLogin()" class="text-purple-400 hover:text-purple-300">Login</a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
};

const renderDashboard = () => {
    app.innerHTML = `
        <!-- Header -->
        <header class="glass p-4 mb-6">
            <div class="container mx-auto flex items-center justify-between">
                <h1 class="text-2xl font-bold neon-glow text-purple-400">Epic Quest Todo</h1>
                <div class="flex items-center gap-6">
                    <div class="text-right">
                        <div class="text-sm text-gray-400">Hero</div>
                        <div class="font-bold">${currentUser.username}</div>
                    </div>
                    <button onclick="logout()" class="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </button>
                </div>
            </div>
        </header>

        <!-- Stats Bar -->
        <div class="container mx-auto px-4 mb-6">
            <div class="glass rounded-2xl p-6">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <!-- Level -->
                    <div class="text-center">
                        <div class="text-4xl font-bold neon-glow text-purple-400">Lv.${stats?.user.level || 1}</div>
                        <div class="text-sm text-gray-400">Level</div>
                    </div>
                    
                    <!-- Experience -->
                    <div class="text-center">
                        <div class="mb-2">
                            <div class="text-sm text-gray-400">Experience</div>
                            <div class="font-bold">${stats?.user.experience || 0} XP</div>
                        </div>
                        <div class="w-full bg-gray-700 rounded-full h-2">
                            <div class="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500" 
                                style="width: ${((stats?.user.experience || 0) % 100)}%"></div>
                        </div>
                        <div class="text-xs text-gray-400 mt-1">${stats?.user.experienceToNextLevel || 100} XP to next level</div>
                    </div>
                    
                    <!-- Streak -->
                    <div class="text-center">
                        <div class="text-2xl font-bold">${stats?.user.streak_days || 0} <i class="fas fa-fire text-orange-400"></i></div>
                        <div class="text-sm text-gray-400">Day Streak</div>
                    </div>
                    
                    <!-- Completed Tasks -->
                    <div class="text-center">
                        <div class="text-2xl font-bold">${stats?.stats.totalTodos || 0} <i class="fas fa-check-circle text-green-400"></i></div>
                        <div class="text-sm text-gray-400">Completed</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <div class="container mx-auto px-4">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Todo List -->
                <div class="lg:col-span-2">
                    <div class="glass rounded-2xl p-6">
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-2xl font-bold">Active Quests</h2>
                            <button onclick="showAddTodoModal()" 
                                class="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transition-all pulse-hover">
                                <i class="fas fa-plus"></i> New Quest
                            </button>
                        </div>
                        
                        <div id="todoList" class="space-y-3">
                            ${renderTodoList()}
                        </div>
                    </div>
                </div>
                
                <!-- Achievements -->
                <div>
                    <div class="glass rounded-2xl p-6">
                        <h2 class="text-2xl font-bold mb-6">Achievements</h2>
                        <div id="achievementsList" class="space-y-3">
                            ${renderAchievements()}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Add Todo Modal -->
        <div id="addTodoModal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div class="glass rounded-2xl p-6 w-full max-w-md">
                <h3 class="text-2xl font-bold mb-4">Create New Quest</h3>
                <form onsubmit="handleAddTodo(event)">
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">Quest Title</label>
                        <input type="text" name="title" required 
                            class="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-purple-400 focus:outline-none transition-colors">
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">Description</label>
                        <textarea name="description" rows="3" 
                            class="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-purple-400 focus:outline-none transition-colors"></textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-sm font-medium mb-2">Category</label>
                            <select name="category" 
                                class="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-purple-400 focus:outline-none transition-colors">
                                <option value="general">📋 General</option>
                                <option value="work">💼 Work</option>
                                <option value="personal">👤 Personal</option>
                                <option value="health">🏃 Health</option>
                                <option value="learning">📚 Learning</option>
                                <option value="creative">🎨 Creative</option>
                                <option value="social">👥 Social</option>
                                <option value="finance">💰 Finance</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">Due Date</label>
                            <input type="datetime-local" name="due_date" 
                                class="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-purple-400 focus:outline-none transition-colors">
                        </div>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">Tags (separate with commas)</label>
                        <input type="text" name="tags" placeholder="urgent, important, quick" 
                            class="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-purple-400 focus:outline-none transition-colors">
                    </div>
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-sm font-medium mb-2">Priority</label>
                            <select name="priority" 
                                class="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-purple-400 focus:outline-none transition-colors">
                                <option value="low">Low</option>
                                <option value="medium" selected>Medium</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">Difficulty</label>
                            <select name="difficulty" 
                                class="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-purple-400 focus:outline-none transition-colors">
                                <option value="easy">Easy (5 XP)</option>
                                <option value="medium" selected>Medium (10 XP)</option>
                                <option value="hard">Hard (20 XP)</option>
                                <option value="epic">Epic (50 XP)</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <button type="submit" 
                            class="flex-1 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transition-all">
                            Create Quest
                        </button>
                        <button type="button" onclick="hideAddTodoModal()" 
                            class="flex-1 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 transition-colors">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
};

const renderTodoList = () => {
    if (todos.length === 0) {
        return `
            <div class="text-center py-8 text-gray-400">
                <i class="fas fa-scroll text-4xl mb-3"></i>
                <p>No active quests. Create your first quest!</p>
            </div>
        `;
    }

    // Sort todos by due date (upcoming first), then by priority
    const sortedTodos = todos.filter(todo => !todo.completed).sort((a, b) => {
        if (a.due_date && b.due_date) {
            return new Date(a.due_date) - new Date(b.due_date);
        }
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;
        
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return sortedTodos.map(todo => {
        const categoryEmojis = {
            general: '📋', work: '💼', personal: '👤', health: '🏃',
            learning: '📚', creative: '🎨', social: '👥', finance: '💰'
        };
        
        const isOverdue = todo.due_date && new Date(todo.due_date) < new Date();
        const isDueSoon = todo.due_date && new Date(todo.due_date) < new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        const tags = todo.tags ? JSON.parse(todo.tags) : [];
        
        return `
        <div class="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all priority-${todo.priority} ${isOverdue ? 'border-l-4 border-red-500' : isDueSoon ? 'border-l-4 border-yellow-500' : ''}">
            <div class="flex items-center justify-between">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-lg">${categoryEmojis[todo.category] || '📋'}</span>
                        <h4 class="font-bold text-lg">${todo.title}</h4>
                        ${isOverdue ? '<span class="text-red-400 text-xs">⚠️ OVERDUE</span>' : isDueSoon ? '<span class="text-yellow-400 text-xs">⏰ DUE SOON</span>' : ''}
                    </div>
                    ${todo.description ? `<p class="text-sm text-gray-400 mb-2">${todo.description}</p>` : ''}
                    ${todo.due_date ? `<p class="text-xs text-gray-500 mb-2">📅 Due: ${new Date(todo.due_date).toLocaleString()}</p>` : ''}
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2 py-1 rounded text-xs difficulty-${todo.difficulty}">${todo.difficulty.toUpperCase()}</span>
                        <span class="text-xs text-gray-400">+${todo.experience_points} XP</span>
                        <span class="px-2 py-1 rounded text-xs bg-blue-500/20">${todo.category}</span>
                        ${tags.map(tag => `<span class="px-2 py-1 rounded text-xs bg-purple-500/20">#${tag}</span>`).join('')}
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="completeTodo(${todo.id})" 
                        class="px-3 py-1 rounded bg-green-500/20 hover:bg-green-500/30 transition-colors">
                        <i class="fas fa-check"></i>
                    </button>
                    <button onclick="deleteTodo(${todo.id})" 
                        class="px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 transition-colors">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    }).join('');
};

const renderAchievements = () => {
    if (!stats?.achievements || stats.achievements.length === 0) {
        return `
            <div class="text-center py-4 text-gray-400">
                <i class="fas fa-trophy text-2xl mb-2"></i>
                <p class="text-sm">Complete quests to unlock achievements!</p>
            </div>
        `;
    }

    return stats.achievements.map(achievement => `
        <div class="p-3 rounded-lg bg-white/5 flex items-center gap-3">
            <div class="text-2xl">${achievement.icon}</div>
            <div>
                <div class="font-bold">${achievement.name}</div>
                <div class="text-xs text-gray-400">${achievement.description}</div>
            </div>
        </div>
    `).join('');
};

// Event Handlers
window.handleLogin = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    try {
        const result = await api.login(formData.get('username'), formData.get('password'));
        
        if (result.token) {
            localStorage.setItem('token', result.token);
            currentUser = result.user;
            showNotification('Welcome back, ' + currentUser.username + '!', 'success');
            init();
        } else {
            showNotification(result.message || 'Login failed', 'error');
        }
    } catch (error) {
        showNotification('Connection error', 'error');
    }
};

window.handleRegister = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    try {
        const result = await api.register(
            formData.get('username'),
            formData.get('email'),
            formData.get('password')
        );
        
        if (result.token) {
            localStorage.setItem('token', result.token);
            currentUser = result.user;
            showNotification('Hero created! Welcome, ' + currentUser.username + '!', 'success');
            init();
        } else {
            showNotification(result.message || 'Registration failed', 'error');
        }
    } catch (error) {
        showNotification('Connection error', 'error');
    }
};

window.handleAddTodo = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    // Parse tags
    const tagsString = formData.get('tags');
    const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    
    try {
        const todo = await api.createTodo({
            title: formData.get('title'),
            description: formData.get('description'),
            priority: formData.get('priority'),
            difficulty: formData.get('difficulty'),
            category: formData.get('category'),
            tags: tags,
            due_date: formData.get('due_date')
        });
        
        todos.unshift(todo);
        renderDashboard();
        hideAddTodoModal();
        showNotification('New quest created!', 'success');
    } catch (error) {
        showNotification('Failed to create quest', 'error');
    }
};

window.completeTodo = async (id) => {
    try {
        const result = await api.completeTodo(id);
        
        if (result.experienceGained) {
            // Update local state
            const todo = todos.find(t => t.id === id);
            if (todo) todo.completed = true;
            
            // Create particle effect
            const event = window.event;
            createParticles(event.clientX, event.clientY);
            
            // Show notification
            showNotification(`Quest completed! +${result.experienceGained} XP`, 'success');
            
            // Check for level up
            if (result.levelUp) {
                setTimeout(() => {
                    showNotification('LEVEL UP! 🎉', 'levelup');
                    // Add level up animation
                    const levelDisplay = document.querySelector('.neon-glow');
                    levelDisplay.classList.add('level-up-animation');
                }, 500);
            }
            
            // Refresh data
            await loadDashboardData();
        }
    } catch (error) {
        showNotification('Failed to complete quest', 'error');
    }
};

window.deleteTodo = async (id) => {
    if (!confirm('Are you sure you want to abandon this quest?')) return;
    
    try {
        await api.deleteTodo(id);
        todos = todos.filter(t => t.id !== id);
        renderDashboard();
        showNotification('Quest abandoned', 'info');
    } catch (error) {
        showNotification('Failed to delete quest', 'error');
    }
};

window.logout = () => {
    localStorage.removeItem('token');
    currentUser = null;
    todos = [];
    stats = null;
    renderAuthForm();
    showNotification('Logged out successfully', 'info');
};

// Modal Functions
window.showAddTodoModal = () => {
    document.getElementById('addTodoModal').classList.remove('hidden');
};

window.hideAddTodoModal = () => {
    document.getElementById('addTodoModal').classList.add('hidden');
};

window.switchToRegister = () => {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
};

window.switchToLogin = () => {
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
};

// Load Dashboard Data
const loadDashboardData = async () => {
    try {
        const [todosData, statsData] = await Promise.all([
            api.getTodos(),
            api.getStats()
        ]);
        
        todos = todosData;
        stats = statsData;
        currentUser = statsData.user;
        
        renderDashboard();
    } catch (error) {
        console.error('Failed to load data:', error);
        showNotification('Failed to load data', 'error');
    }
};

// Initialize App
const init = async () => {
    const token = localStorage.getItem('token');
    
    if (token) {
        try {
            await loadDashboardData();
        } catch (error) {
            localStorage.removeItem('token');
            renderAuthForm();
        }
    } else {
        renderAuthForm();
    }
    
    // Hide loading screen
    setTimeout(() => {
        loading.style.opacity = '0';
        setTimeout(() => loading.style.display = 'none', 300);
    }, 500);
};

// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Start the app
init();
