import React, { useState, useEffect, useRef, useMemo, FC, ReactNode } from 'react';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAnalytics, Analytics } from "firebase/analytics";
import {
    getAuth,
    signInWithCustomToken,
    signInAnonymously,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    User
} from 'firebase/auth';
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    onSnapshot,
    Firestore
} from 'firebase/firestore';
import {
    Search, Star, Clock, MapPin, Building, Package, Truck, List, User as UserIcon, LogOut, Plus, ChevronLeft,
    ChevronRight, ChevronDown, Menu, X, Bot, Send, CheckCircle, TrendingUp, SlidersHorizontal, Shirt,
    BadgePercent, ThumbsUp, BrainCircuit, MessageSquare, ClipboardCopy, FileText, Briefcase, DollarSign,
    Users, GanttChartSquare, LayoutDashboard, Filter, Check, MoreHorizontal, Info, Settings, LifeBuoy,
    History, Edit, Anchor, Ship, Warehouse, PackageCheck, Award, Globe, PieChart as PieChartIcon, Flame,
    PlayCircle, BarChart as BarChartIcon, FileQuestion, ClipboardCheck, ChevronsLeft, ChevronsRight, Trash2,
    Tag, Weight, Palette, Box, Map as MapIcon
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Pie, Cell, PieChart
} from 'recharts';

// --- Type Definitions ---
interface FirebaseConfig {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId: string;
}

interface UserProfile {
    name: string;
    companyName: string;
    phone: string;
    email: string;
    country: string;
    jobRole: string;
    categorySpecialization: string;
    yearlyEstRevenue: string;
}

interface OrderFormData {
    category: string;
    fabricQuality: string;
    weightGSM: string;
    styleOption: string;
    qty: string;
    targetPrice: string;
    shippingDest: string;
    packagingReqs: string;
    labelingReqs: string;
}

interface MachineSlot {
    machineType: string;
    availableSlots: number;
    totalSlots: number;
    nextAvailable: string;
}

interface Factory {
    id: string;
    name: string;
    specialties: string[];
    rating: number;
    turnaround: string;
    offer: string | null;
    imageUrl: string;
    location: string;
    tags: string[];
    description: string;
    minimumOrderQuantity: number;
    certifications: string[];
    machineSlots: MachineSlot[];
}

interface QuoteRequest {
    id: string;
    factory: {
        id: string;
        name: string;
        location: string;
        imageUrl: string;
    };
    order: OrderFormData;
    status: 'Pending' | 'Responded' | 'Accepted' | 'Declined';
    submittedAt: string;
    userId: string;
    files?: string[];
}

interface ToastState {
    show: boolean;
    message: string;
    type: 'success' | 'error';
}

declare global {
    interface Window {
        showToast: (message: string, type?: 'success' | 'error') => void;
    }
    const __initial_auth_token: string | undefined;
    const __app_id: string | undefined;
}

// --- Firebase Initialization ---
const firebaseConfig: FirebaseConfig = {
    apiKey: "AIzaSyCBzA20CJ7ZUNpRywgeZE0BhjoXn_gkp-A",
    authDomain: "auctave-user-crm.firebaseapp.com",
    projectId: "auctave-user-crm",
    storageBucket: "auctave-user-crm.firebasestorage.app",
    messagingSenderId: "402176147974",
    appId: "1:402176147974:web:26416d0a2682f45ce87987",
    measurementId: "G-H909ZJLHP3"
};

const app: FirebaseApp = initializeApp(firebaseConfig);
const analytics: Analytics = getAnalytics(app);
const auth = getAuth(app);
const db: Firestore = getFirestore(app);

// --- Helper Functions ---
const copyToClipboard = (text: string, successMessage: string = 'Copied to clipboard!') => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        if (window.showToast) window.showToast(successMessage);
        else alert(successMessage);
    } catch (err) {
        console.error('Failed to copy: ', err);
        if (window.showToast) window.showToast('Failed to copy text.', 'error');
        else alert('Failed to copy text.');
    }
    document.body.removeChild(textArea);
};

// --- Main App Component ---
const App: FC = () => {
    // --- State Management ---
    const [currentPage, setCurrentPage] = useState<string>('login');
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
    const [isProfileLoading, setIsProfileLoading] = useState<boolean>(false);
    const [authError, setAuthError] = useState<string>('');
    const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
    const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });
    const [pageKey, setPageKey] = useState<number>(0);

    // --- App Logic & Data States ---
    const [orderFormData, setOrderFormData] = useState<OrderFormData>({
        category: 'T-shirt', fabricQuality: '100% Cotton', weightGSM: '180', styleOption: 'Crew Neck, Short Sleeve', qty: '5000', targetPrice: '4.50', shippingDest: 'Los Angeles, USA', packagingReqs: 'Individually folded and poly-bagged', labelingReqs: 'Custom neck labels'
    });
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [suggestedFactories, setSuggestedFactories] = useState<Factory[]>([]);
    const [selectedFactory, setSelectedFactory] = useState<Factory | null>(null);
    const [selectedGarmentCategory, setSelectedGarmentCategory] = useState<string>('All');
    const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
    const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null);

    // --- Gemini (AI) Feature States ---
    const [contractBrief, setContractBrief] = useState<string>('');
    const [optimizationSuggestions, setOptimizationSuggestions] = useState<string>('');
    const [outreachEmail, setOutreachEmail] = useState<string>('');
    const [marketTrends, setMarketTrends] = useState<string>('');
    const [negotiationTips, setNegotiationTips] = useState<string>('');
    const [isLoadingBrief, setIsLoadingBrief] = useState<boolean>(false);
    const [isLoadingOptimizations, setIsLoadingOptimizations] = useState<boolean>(false);
    const [isLoadingEmail, setIsLoadingEmail] = useState<boolean>(false);
    const [isLoadingTrends, setIsLoadingTrends] = useState<boolean>(false);
    const [isLoadingNegotiation, setIsLoadingNegotiation] = useState<boolean>(false);

    // --- Global Functions ---
    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };
    const handleSetCurrentPage = (page: string, data: any = null) => {
        setPageKey(prevKey => prevKey + 1);
        if (page === 'quoteRequest') {
            setSelectedFactory(data as Factory);
        }
        if (page === 'quoteDetail') {
            setSelectedQuote(data as QuoteRequest);
        }
        setCurrentPage(page);
    };

    useEffect(() => { window.showToast = showToast; }, []);

    // --- Firebase & Navigation Hooks ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                await fetchUserProfile(currentUser.uid);
                fetchQuoteRequests(currentUser.uid);
            } else {
                setUser(null); setUserProfile(null); handleSetCurrentPage('login');
            }
            setIsAuthReady(true);
        });
        const signInInitial = async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) { console.error("Firebase initial sign-in error:", error); setAuthError("Failed to sign in automatically."); }
        };
        if (!auth.currentUser) signInInitial();
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (isAuthReady && user) {
            if (isProfileLoading) return;
            const validProfile = userProfile?.name && userProfile?.companyName && userProfile?.phone;
            if (validProfile) {
                if (currentPage === 'profile' || currentPage === 'login') {
                    handleSetCurrentPage('sourcing');
                }
            } else {
                handleSetCurrentPage('profile');
            }
        } else if (isAuthReady && !user) {
            handleSetCurrentPage('login');
        }
    }, [isAuthReady, user, userProfile, isProfileLoading]);

    // --- Authentication & Profile Functions ---
    const handleEmailSignUp = async (email, password) => {
        setAuthError('');
        if (!email || !password) { setAuthError("Email and password cannot be empty."); return; }
        try { await createUserWithEmailAndPassword(auth, email, password); }
        catch (error) { setAuthError((error as Error).message); }
    };

    const handleEmailSignIn = async (email, password) => {
        setAuthError('');
        if (!email || !password) { setAuthError("Email and password cannot be empty."); return; }
        try { await signInWithEmailAndPassword(auth, email, password); }
        catch (error) { setAuthError((error as Error).message); }
    };

    const handleGoogleSignIn = async () => {
        setAuthError('');
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            setAuthError((error as Error).message);
        }
    };

    const handleSignOut = async () => {
        try { await signOut(auth); } catch (error) { setAuthError((error as Error).message); }
    };

    const fetchUserProfile = async (uid: string) => {
        setIsProfileLoading(true);
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const userDocRef = doc(db, `artifacts/${appId}/users/${uid}/profile`, 'buyerProfile');
            const docSnap = await getDoc(userDocRef);
            setUserProfile(docSnap.exists() ? docSnap.data() as UserProfile : null);
        } catch (error) { console.error("Error fetching user profile:", error); }
        finally { setIsProfileLoading(false); }
    };

    const saveUserProfile = async (profileData: Partial<UserProfile>) => {
        if (!user) { setAuthError("No user logged in to save profile."); return; }
        setIsProfileLoading(true);
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile`, 'buyerProfile');
            await setDoc(userDocRef, { ...profileData, email: profileData.email || user.email }, { merge: true });
            setUserProfile({ ...userProfile, ...profileData, email: profileData.email || user.email } as UserProfile);
            handleSetCurrentPage('sourcing');
            showToast('Profile saved successfully!');
        } catch (error) { setAuthError("Failed to save profile: " + (error as Error).message); }
        finally { setIsProfileLoading(false); }
    };

    // --- Quote Request Functions ---
    const submitQuoteRequest = async (quoteData: Omit<QuoteRequest, 'id' | 'status' | 'submittedAt' | 'userId'>) => {
        if (!user) {
            showToast('You must be logged in to request a quote.', 'error');
            return;
        }
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const quotesColRef = collection(db, `artifacts/${appId}/users/${user.uid}/quotes`);
            await addDoc(quotesColRef, {
                ...quoteData,
                status: 'Pending',
                submittedAt: new Date().toISOString(),
                userId: user.uid,
            });
            showToast('Quote request submitted successfully!');
            handleSetCurrentPage('myQuotes');
        } catch (error) {
            console.error("Error submitting quote request:", error);
            showToast('Failed to submit quote request.', 'error');
        }
    };

    const fetchQuoteRequests = (uid: string) => {
        if (!uid) return;
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const quotesQuery = query(collection(db, `artifacts/${appId}/users/${uid}/quotes`));
        const unsubscribe = onSnapshot(quotesQuery, (querySnapshot) => {
            const quotes: QuoteRequest[] = [];
            querySnapshot.forEach((doc) => {
                quotes.push({ id: doc.id, ...doc.data() } as QuoteRequest);
            });
            setQuoteRequests(quotes);
        }, (error) => {
            console.error("Error fetching quote requests:", error);
            showToast('Could not fetch quote requests.', 'error');
        });
        return unsubscribe;
    };

    // --- Gemini API Call ---
    const callGeminiAPI = async (prompt: string): Promise<string> => {
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
        const apiKey = ""; // Provided by Canvas
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        const result = await response.json();
        if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
            return result.candidates[0].content.parts[0].text;
        }
        throw new Error('Unexpected API response format.');
    };

    // --- App Feature Functions ---
    const allFactories: Factory[] = useMemo(() => [
        { id: 'F001', name: 'AU Global Garment Solutions', specialties: ['T-shirt', 'Polo Shirt', 'Hoodies'], rating: 4.8, turnaround: '25-35 days', offer: '10% OFF', imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?q=80&w=2864&auto=format&fit=crop', location: 'Dhaka, Bangladesh', tags: ['Prime', 'Tech Enabled', 'Sustainable'], description: 'Leading, fully-integrated knit apparel manufacturer in Bangladesh.', minimumOrderQuantity: 1000, certifications: ['Sedex', 'Oeko-Tex Standard 100', 'BCI'], machineSlots: [ { machineType: 'Single Needle Lock Stitch', availableSlots: 50, totalSlots: 60, nextAvailable: '2025-07-15' }, { machineType: 'Overlock Machine', availableSlots: 35, totalSlots: 40, nextAvailable: '2025-07-20' } ] },
        { id: 'F002', name: 'AU Precision Textiles Inc.', specialties: ['T-shirt', 'Jeans'], rating: 4.6, turnaround: '30-40 days', offer: null, imageUrl: 'https://images.unsplash.com/photo-1523381294911-8d3cead13475?q=80&w=2940&auto=format&fit=crop', location: 'Hanoi, Vietnam', tags: ['Tech Enabled'], description: 'High-volume T-shirt and denim production with modern machinery.', minimumOrderQuantity: 2000, certifications: ['ISO 9001'], machineSlots: [ { machineType: 'Denim Weaving Loom', availableSlots: 15, totalSlots: 20, nextAvailable: '2025-08-01' }, { machineType: 'Automatic Pocket Setter', availableSlots: 10, totalSlots: 10, nextAvailable: '2025-08-05' } ] },
        { id: 'F003', name: 'AU Innovate Apparel Co.', specialties: ['Hoodies', 'Jackets'], rating: 4.9, turnaround: '20-30 days', offer: 'FREE SAMPLES', imageUrl: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=2872&auto=format&fit=crop', location: 'Mumbai, India', tags: ['Prime', 'Fast Turnaround'], description: 'Innovative solutions for outerwear manufacturing with fast turnaround.', minimumOrderQuantity: 500, certifications: ['WRAP', 'Sedex'], machineSlots: [ { machineType: 'Heavy Duty Sewing Machine', availableSlots: 25, totalSlots: 30, nextAvailable: '2025-07-10' } ] },
        { id: 'F004', name: 'AU Denim Dreams', specialties: ['Jeans', 'Jackets'], rating: 4.7, turnaround: '35-45 days', offer: 'BULK DISCOUNT', imageUrl: 'https://images.unsplash.com/photo-1602293589922-2542a03598c9?q=80&w=2940&auto=format&fit=crop', location: 'Istanbul, Turkey', tags: ['Sustainable'], description: 'Go-to partner for authentic, high-quality denim products.', minimumOrderQuantity: 1500, certifications: ['Oeko-Tex Standard 100', 'BCI'], machineSlots: [ { machineType: 'Laser Finishing Machine', availableSlots: 8, totalSlots: 10, nextAvailable: '2025-08-10' } ] },
        { id: 'F005', name: 'AU Polo Perfection', specialties: ['Polo Shirt'], rating: 4.9, turnaround: '15-25 days', offer: null, imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=2940&auto=format&fit=crop', location: 'Porto, Portugal', tags: ['Prime', 'Fast Turnaround'], description: 'Specialists in premium polo shirts with unparalleled craftsmanship.', minimumOrderQuantity: 500, certifications: ['Oeko-Tex Standard 100', 'WRAP'], machineSlots: [ { machineType: 'Knitting Machine', availableSlots: 30, totalSlots: 35, nextAvailable: '2025-07-08' } ] },
        { id: 'F006', name: 'AU Tiruppur Knits', specialties: ['T-shirt', 'Polo Shirt'], rating: 4.7, turnaround: '20-30 days', offer: '5% First Order', imageUrl: 'https://images.unsplash.com/photo-1618517351639-a86b993468a7?q=80&w=2940&auto=format&fit=crop', location: 'Tiruppur, India', tags: ['Sustainable', 'Prime'], description: 'King of knitwear in the dollar town of India, specializing in high-quality cotton T-shirts.', minimumOrderQuantity: 1000, certifications: ['Oeko-Tex Standard 100', 'BCI'], machineSlots: [ { machineType: 'Circular Knitting Machine', availableSlots: 40, totalSlots: 50, nextAvailable: '2025-07-22' } ] },
    ], []);

    const handleSubmitOrderForm = (submittedData: OrderFormData, files: File[]) => {
        setOrderFormData(submittedData);
        setUploadedFiles(files);
        const matchingFactories = allFactories.filter(f => f.specialties.includes(submittedData.category));
        setSuggestedFactories(matchingFactories);
        handleSetCurrentPage('factorySuggestions');
    };

    const handleSelectFactory = (factory: Factory) => {
        setSelectedFactory(factory);
        setContractBrief(''); setOutreachEmail(''); setOptimizationSuggestions(''); setNegotiationTips('');
        handleSetCurrentPage('factoryDetail');
    };

    // --- Gemini Feature Functions ---
    const generateContractBrief = async () => { setIsLoadingBrief(true); const prompt = `Generate a concise, professional contract brief for a garment manufacturing request with these specs: Category: ${orderFormData.category}, Fabric: ${orderFormData.fabricQuality}, Weight: ${orderFormData.weightGSM} GSM, Style: ${orderFormData.styleOption}, Quantity: ${orderFormData.qty} units. The brief should be suitable for an initial inquiry to ${selectedFactory.name}.`; try { setContractBrief(await callGeminiAPI(prompt)); } catch (error) { showToast('Error generating brief: ' + (error as Error).message, 'error'); } finally { setIsLoadingBrief(false); } };
    const suggestOptimizations = async () => { setIsLoadingOptimizations(true); const prompt = `For a garment order (${orderFormData.category}, ${orderFormData.fabricQuality}, ${orderFormData.weightGSM} GSM), suggest material or process optimizations for cost-efficiency, sustainability, or quality, keeping in mind we are contacting ${selectedFactory.name} in ${selectedFactory.location}. Format as a bulleted list.`; try { setOptimizationSuggestions(await callGeminiAPI(prompt)); } catch (error) { showToast('Error suggesting optimizations: ' + (error as Error).message, 'error'); } finally { setIsLoadingOptimizations(false); } };
    const generateOutreachEmail = async () => { if (!contractBrief || !selectedFactory || !userProfile) { showToast('Please generate a brief first.', 'error'); return; } setIsLoadingEmail(true); const prompt = `Draft a professional outreach email from ${userProfile.name} of ${userProfile.companyName} to ${selectedFactory.name}. The email should introduce the company and the order, referencing the attached contract brief. Keep it concise and aim to start a conversation. The contract brief is as follows:\n\n---\n${contractBrief}\n---`; try { setOutreachEmail(await callGeminiAPI(prompt)); } catch (error) { showToast('Error drafting email: ' + (error as Error).message, 'error'); } finally { setIsLoadingEmail(false); } };
    const getMarketTrends = async () => { setIsLoadingTrends(true); const date = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); const prompt = `As a fashion industry analyst, provide a brief summary of key market trends in global garment manufacturing for ${date}. Focus on sustainability, technology, and consumer behavior. Format as a bulleted list.`; try { setMarketTrends(await callGeminiAPI(prompt)); } catch (error) { setMarketTrends('Error fetching market trends: ' + (error as Error).message); showToast('Error fetching market trends.', 'error'); } finally { setIsLoadingTrends(false); } };
    const getNegotiationTips = async () => { if (!selectedFactory) return; setIsLoadingNegotiation(true); const prompt = `As a sourcing expert, provide key negotiation points and cultural tips for an upcoming discussion with ${selectedFactory.name} in ${selectedFactory.location} regarding an order of ${orderFormData.qty} ${orderFormData.category}s. Focus on pricing strategies, payment terms, and quality assurance questions. Format as a bulleted list with bold headings.`; try { setNegotiationTips(await callGeminiAPI(prompt)); } catch(error) { setNegotiationTips('Error fetching negotiation tips: ' + (error as Error).message); showToast('Error fetching negotiation tips.', 'error'); } finally { setIsLoadingNegotiation(false); } };

    // --- UI Components ---
    const Toast: FC<{ message: string; type: 'success' | 'error'; show: boolean }> = ({ message, type, show }) => ( <div className={`fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white transition-transform duration-300 ${show ? 'translate-x-0' : 'translate-x-[110%]'} ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`} style={{ zIndex: 1000 }}><div className="flex items-center"><CheckCircle className="mr-2"/> {message}</div></div> );

    const SideMenu: FC = () => {
        const menuItems = [
            { name: 'Sourcing', page: 'sourcing', icon: <Search className="h-5 w-5" /> },
            { name: 'My Quotes', page: 'myQuotes', icon: <FileQuestion className="h-5 w-5" /> },
            { name: 'CRM Portal', page: 'crm', icon: <List className="h-5 w-5" /> },
            { name: 'Order Tracking', page: 'tracking', icon: <Truck className="h-5 w-5" /> },
            { name: 'Place Order', page: 'orderForm', icon: <Plus className="h-5 w-5" /> },
            { name: 'Profile', page: 'profile', icon: <UserIcon className="h-5 w-5" /> },
            { name: 'Settings', page: 'settings', icon: <Settings className="h-5 w-5" /> },
            { name: "What's Trending", page: 'trending', icon: <Flame className="h-5 w-5" /> },
        ];
        return (<>
            {isMenuOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={toggleMenu}></div>}
            <aside className={`fixed inset-y-0 left-0 bg-gray-900 text-white flex flex-col shadow-lg z-50 transition-all duration-300 ease-in-out md:relative ${isMenuOpen ? 'w-64' : '-translate-x-full w-64'} md:translate-x-0 ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'}`}>
                <div className={`flex items-center justify-between p-4 border-b border-gray-700 ${isSidebarCollapsed ? 'md:justify-center' : ''}`}>
                    {!isSidebarCollapsed && <h1 className="text-2xl font-bold text-white">Auctave</h1>}
                    <button onClick={toggleMenu} className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white md:hidden">
                        <X className="w-6 h-6"/>
                    </button>
                    <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden md:block p-2 rounded-md hover:bg-gray-700 text-white">
                        {isSidebarCollapsed ? <ChevronsRight className="w-6 h-6"/> : <ChevronsLeft className="w-6 h-6"/>}
                    </button>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {menuItems.map(item => (
                        <button key={item.name} onClick={() => { handleSetCurrentPage(item.page); if (isMenuOpen) toggleMenu(); }} className={`w-full text-left p-3 rounded-md font-medium flex items-center transition duration-150 ease-in-out ${isSidebarCollapsed ? 'justify-center' : ''} ${currentPage === item.page ? 'bg-purple-600 text-white' : 'hover:bg-gray-700'}`} title={isSidebarCollapsed ? item.name : ''}>
                            <div className={isSidebarCollapsed ? '' : 'mr-3'}>{item.icon}</div>
                            {!isSidebarCollapsed && <span>{item.name}</span>}
                        </button>
                    ))}
                </nav>
                <div className={`p-4 border-t border-gray-700 ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
                    <button onClick={() => { handleSignOut(); if (isMenuOpen) toggleMenu(); }} className={`w-full text-left p-3 rounded-md font-medium hover:bg-red-700 flex items-center transition duration-150 ease-in-out text-red-300 ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? 'Logout' : ''}>
                        <div className={isSidebarCollapsed ? '' : 'mr-3'}><LogOut className="h-5 w-5"/></div>
                        {!isSidebarCollapsed && <span>Logout</span>}
                    </button>
                </div>
            </aside>
        </>);
    };

    const BottomNavBar: FC = () => {
        const navItems = [
          { name: 'Sourcing', page: 'sourcing', icon: <Search /> },
          { name: 'My Quotes', page: 'myQuotes', icon: <FileQuestion /> },
          { name: 'Orders', page: 'crm', icon: <List /> },
          { name: 'Tracking', page: 'tracking', icon: <Truck /> },
          { name: 'Trending', page: 'trending', icon: <Flame /> },
        ];
        return (
          <div className="fixed bottom-0 left-0 right-0 h-20 md:hidden z-40">
              <div className="absolute bottom-0 left-0 right-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.1)] h-16">
                  <div className="flex justify-around items-center h-full">
                      {navItems.map(item => (
                          <button key={item.name} onClick={() => handleSetCurrentPage(item.page)} className={`flex flex-col items-center justify-center space-y-1 w-1/5 ${currentPage === item.page ? 'text-purple-600' : 'text-gray-500'}`}>
                              {item.icon}
                              <span className="text-xs font-medium">{item.name}</span>
                          </button>
                      ))}
                  </div>
              </div>
              <button onClick={() => handleSetCurrentPage('orderForm')} className="absolute bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-white shadow-lg transform transition-transform hover:scale-110">
                  <Plus size={32}/>
              </button>
          </div>
        );
    }

    const MainLayout: FC<{ children: ReactNode; pageKey: number }> = ({ children, pageKey }) => (
        <div className="flex min-h-screen bg-gray-100 font-inter">
            <div className="hidden md:flex"><SideMenu /></div>
            <main className="flex-1 flex flex-col overflow-hidden">
                <div key={pageKey} className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 animate-fade-in">
                    {children}
                </div>
            </main>
            {user && <BottomNavBar />}
        </div>
    );

    const LoginPage: FC = () => {
        const [email, setEmail] = useState('');
        const [password, setPassword] = useState('');
        return ( <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4 font-inter"> <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-md text-center"> <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome to Auctave</h2> <p className="text-gray-500 mb-6">Your Garment Sourcing Partner</p> {authError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{authError}</div>} <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition" /> <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition" /> <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4"> <button onClick={() => handleEmailSignIn(email, password)} className="w-full p-3 text-white rounded-lg font-semibold bg-purple-600 hover:bg-purple-700 transition duration-150 ease-in-out shadow-md"> Sign In </button> <button onClick={() => handleEmailSignUp(email, password)} className="w-full p-3 text-purple-600 rounded-lg font-semibold bg-purple-100 hover:bg-purple-200 transition duration-150 ease-in-out shadow-md"> Sign Up </button> </div> <div className="relative flex py-2 items-center"> <div className="flex-grow border-t border-gray-300"></div> <span className="flex-shrink mx-4 text-gray-400 text-sm">OR</span> <div className="flex-grow border-t border-gray-300"></div> </div> <button onClick={handleGoogleSignIn} className="w-full p-3 mt-2 flex items-center justify-center bg-white border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition duration-150 ease-in-out shadow-sm"> <svg className="w-5 h-5 mr-2" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#34A853" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l5.657,5.657C40.046,36.64,44,31.1,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FBBC05" d="M9.916,28.421c-0.303-0.92-0.465-1.897-0.465-2.921s0.162-2.001,0.465-2.921l-5.657-5.657C2.353,19.252,2,21.556,2,24s0.353,4.748,1.259,6.626L9.916,28.421z"></path><path fill="#EA4335" d="M24,48c5.268,0,10.046-1.947,13.416-5.239l-5.657-5.657C30.041,38.223,27.217,39.3,24,39.3c-3.413,0-6.425-1.823-8.084-4.571l-5.657,5.657C12.016,44.38,17.555,48,24,48z"></path><path fill="none" d="M0,0h48v48H0V0z"></path></svg> Sign in with Google </button> </div> </div> );
    };

    const ProfilePage: FC = () => {
        const [profileData, setProfileData] = useState<Partial<UserProfile>>({
            name: userProfile?.name || user?.displayName || '',
            companyName: userProfile?.companyName || '',
            phone: userProfile?.phone || '',
            email: user?.email || '',
            country: userProfile?.country || '',
            jobRole: userProfile?.jobRole || '',
            categorySpecialization: userProfile?.categorySpecialization || '',
            yearlyEstRevenue: userProfile?.yearlyEstRevenue || ''
        });
        const countries = ["Afghanistan","India","United States of America","China","Bangladesh", "Vietnam", "Turkey", "Portugal"];
        const jobRoles = ["Owner/Founder", "CEO/President", "Sourcing Manager", "Designer"];
        const revenueRanges = ["<$1M", "$1M - $5M", "$5M - $10M", "$10M+"];
        const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
            const { name, value } = e.target;
            setProfileData(prevData => ({ ...prevData, [name]: value }));
        };
        const handleSaveProfile = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!profileData.name || !profileData.companyName || !profileData.phone || !profileData.email) {
                showToast("Please fill all required fields.", "error");
                return;
            }
            await saveUserProfile(profileData);
        };
        return ( <MainLayout pageKey={pageKey}> <div className="max-w-2xl mx-auto"> <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg"> <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">{userProfile?.name ? 'Update Your Profile' : 'Create Your Buyer Profile'}</h2> <p className="text-center text-gray-500 mb-6">Fields marked with * are required.</p> {authError && <p className="text-red-500 mb-4">{authError}</p>} <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6"> <div> <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label> <input type="text" id="name" name="name" value={profileData.name} onChange={handleProfileChange} required className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" /> </div> <div> <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">Company Name <span className="text-red-500">*</span></label> <input type="text" id="companyName" name="companyName" value={profileData.companyName} onChange={handleProfileChange} required className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" /> </div> <div className="md:col-span-2"> <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label> <input type="email" id="email" name="email" value={profileData.email} onChange={handleProfileChange} required className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" /> </div> <div> <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label> <input type="tel" id="phone" name="phone" value={profileData.phone} onChange={handleProfileChange} required className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" /> </div> <div> <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">Country</label> <select id="country" name="country" value={profileData.country} onChange={handleProfileChange} className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"> <option value="">Select a country</option> {countries.map(country => (<option key={country} value={country}>{country}</option>))} </select> </div> <div> <label htmlFor="jobRole" className="block text-sm font-medium text-gray-700 mb-1">Job Role</label> <select id="jobRole" name="jobRole" value={profileData.jobRole} onChange={handleProfileChange} className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"> <option value="">Select a role</option> {jobRoles.map(role => (<option key={role} value={role}>{role}</option>))} </select> </div> <div> <label htmlFor="categorySpecialization" className="block text-sm font-medium text-gray-700 mb-1">Category Specialization</label> <input type="text" id="categorySpecialization" name="categorySpecialization" placeholder="e.g., Activewear, Denim" value={profileData.categorySpecialization} onChange={handleProfileChange} className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" /> </div> <div> <label htmlFor="yearlyEstRevenue" className="block text-sm font-medium text-gray-700 mb-1">Est. Yearly Revenue (USD)</label> <select id="yearlyEstRevenue" name="yearlyEstRevenue" value={profileData.yearlyEstRevenue} onChange={handleProfileChange} className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"> <option value="">Select a revenue range</option> {revenueRanges.map(range => (<option key={range} value={range}>{range}</option>))} </select> </div> <div className="md:col-span-2 text-right mt-4"> <button type="submit" disabled={isProfileLoading} className="w-full md:w-auto px-6 py-3 text-white rounded-md font-semibold bg-purple-600 hover:bg-purple-700 transition shadow-md disabled:opacity-50"> {isProfileLoading ? 'Saving...' : 'Save Profile'} </button> </div> </form> </div> </div> </MainLayout> );
    };

    const SettingsPage: FC = () => {
        const [location, setLocation] = useState(userProfile?.country || 'Your Location');
        const handleLocationSave = () => {
            showToast(`Location updated to ${location}`);
        };
        const settingsOptions = [
            { title: "My Profile", description: "Update your personal and company information", icon: <Edit size={20} />, action: () => handleSetCurrentPage('profile'), buttonLabel: "Edit Profile" },
            { title: "Contact Customer Care", description: "Get help with your account or any issue", icon: <LifeBuoy size={20} />, action: () => { window.location.href = 'mailto:support@auctave.com'; }, buttonLabel: "Email Support" },
            { title: "Order Details", description: "View and track all your past and current orders", icon: <History size={20} />, action: () => handleSetCurrentPage('crm'), buttonLabel: "View Orders" },
        ];
        return (
            <MainLayout pageKey={pageKey}>
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-800 mb-8">Settings</h1>
                    <div className="space-y-6">
                        {settingsOptions.map((opt, index) => (
                            <div key={index} className="bg-white p-6 rounded-xl shadow-sm border flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-purple-100 text-purple-600 p-3 rounded-lg">{opt.icon}</div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-800">{opt.title}</h3>
                                        <p className="text-sm text-gray-500">{opt.description}</p>
                                    </div>
                                </div>
                                <button onClick={opt.action} className="bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-200 transition text-sm">
                                    {opt.buttonLabel}
                                </button>
                            </div>
                        ))}
                            <div className="bg-white p-6 rounded-xl shadow-sm border">
                                <div className="flex items-center gap-4">
                                    <div className="bg-purple-100 text-purple-600 p-3 rounded-lg"><MapPin size={20}/></div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-800">Change Location</h3>
                                        <p className="text-sm text-gray-500">Update your primary business location.</p>
                                    </div>
                                </div>
                                <div className="mt-4 flex gap-4 items-center">
                                    <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="flex-grow p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" />
                                    <button onClick={handleLocationSave} className="bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-purple-700 transition">Save</button>
                                </div>
                            </div>
                    </div>
                </div>
            </MainLayout>
        )
    }

    const AiCard: FC<{ icon: ReactNode; title: string; children: ReactNode }> = React.memo(({ icon, title, children }) => ( <div className="bg-white p-6 rounded-xl shadow-lg h-full flex flex-col"> <div className="flex items-center text-xl font-bold text-gray-800 mb-4">{icon}{title}</div> {children} </div> ));

    const OrderFormPage: FC = () => {
        const [formState, setFormState] = useState<OrderFormData>({
            category: 'T-shirt', qty: '5000', fabricQuality: '100% Cotton', weightGSM: '180',
            targetPrice: '4.50', shippingDest: 'Los Angeles, USA',
            packagingReqs: 'Individually folded and poly-bagged, 50 units per carton.',
            labelingReqs: 'Custom branded neck label and hang tags required.', styleOption: 'Crew neck, short sleeves'
        });
        const [files, setFiles] = useState<File[]>([]);
        const fileInputRef = useRef<HTMLInputElement>(null);
        const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { const { name, value } = e.target; setFormState(prev => ({ ...prev, [name]: value })); };
        const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files) {
                setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
            }
        };
        const removeFile = (fileName: string) => {
            setFiles(prev => prev.filter(f => f.name !== fileName));
        };
        const onFormSubmit = (e: React.FormEvent) => { e.preventDefault(); handleSubmitOrderForm(formState, files); };

        const FormField: FC<{ icon: ReactNode; label: string; children: ReactNode }> = ({ icon, label, children }) => (
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        {icon}
                    </div>
                    {children}
                </div>
            </div>
        );

        return (
            <MainLayout pageKey={pageKey}>
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-3xl font-bold text-gray-800 mb-2">Garment Sourcing Requirements</h2>
                                <p className="text-gray-500">Fill out your order details to find matching factories.</p>
                            </div>
                            <button onClick={() => handleSetCurrentPage('sourcing')} className="text-sm text-purple-600 font-semibold flex items-center hover:underline whitespace-nowrap">
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Back to Sourcing
                            </button>
                        </div>
                        <form onSubmit={onFormSubmit} className="space-y-8">
                            <fieldset className="border-t pt-6">
                                <legend className="text-lg font-semibold text-gray-700 mb-4">Basic Details</legend>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField label="Product Category" icon={<Shirt className="h-5 w-5 text-gray-400" />}>
                                        <select name="category" value={formState.category} onChange={handleFormChange} className="w-full pl-10 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white appearance-none">
                                            <option>T-shirt</option> <option>Polo Shirt</option> <option>Hoodies</option> <option>Jeans</option> <option>Jackets</option> <option>Shirts</option> <option>Casual Shirts</option> <option>Trousers</option>
                                        </select>
                                    </FormField>
                                    <FormField label="Order Quantity (Units)" icon={<Package className="h-5 w-5 text-gray-400" />}>
                                        <input type="number" name="qty" value={formState.qty} onChange={handleFormChange} placeholder="e.g., 5000" className="w-full pl-10 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" />
                                    </FormField>
                                </div>
                            </fieldset>

                            <fieldset className="border-t pt-6">
                                <legend className="text-lg font-semibold text-gray-700 mb-4">Specifications</legend>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField label="Fabric Quality/Composition" icon={<Award className="h-5 w-5 text-gray-400" />}>
                                        <input type="text" name="fabricQuality" value={formState.fabricQuality} onChange={handleFormChange} placeholder="e.g., 100% Organic Cotton" className="w-full pl-10 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" />
                                    </FormField>
                                    <FormField label="Fabric Weight (GSM)" icon={<Weight className="h-5 w-5 text-gray-400" />}>
                                        <input type="number" name="weightGSM" value={formState.weightGSM} onChange={handleFormChange} placeholder="e.g., 180" className="w-full pl-10 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" />
                                    </FormField>
                                    <div className="md:col-span-2">
                                        <FormField label="Style Options / Tech Pack Details" icon={<Palette className="h-5 w-5 text-gray-400" />}>
                                            <textarea name="styleOption" value={formState.styleOption} onChange={handleFormChange} rows={3} placeholder="e.g., Crew neck, specific pantone colors, embroidery details..." className="w-full pl-10 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"></textarea>
                                        </FormField>
                                    </div>
                                </div>
                            </fieldset>

                            <fieldset className="border-t pt-6">
                                <legend className="text-lg font-semibold text-gray-700 mb-4">Logistics & Commercials</legend>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField label="Target Price per Unit (USD)" icon={<DollarSign className="h-5 w-5 text-gray-400" />}>
                                        <input type="number" step="0.01" name="targetPrice" value={formState.targetPrice} onChange={handleFormChange} placeholder="e.g., 4.50" className="w-full pl-10 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" />
                                    </FormField>
                                    <FormField label="Shipping Destination" icon={<MapIcon className="h-5 w-5 text-gray-400" />}>
                                        <input type="text" name="shippingDest" value={formState.shippingDest} onChange={handleFormChange} placeholder="e.g., Los Angeles, USA" className="w-full pl-10 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" />
                                    </FormField>
                                    <div className="md:col-span-2">
                                        <FormField label="Packaging Requirements" icon={<Box className="h-5 w-5 text-gray-400" />}>
                                            <textarea name="packagingReqs" value={formState.packagingReqs} onChange={handleFormChange} rows={4} className="w-full pl-10 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"></textarea>
                                        </FormField>
                                    </div>
                                    <div className="md:col-span-2">
                                        <FormField label="Labeling Requirements" icon={<Tag className="h-5 w-5 text-gray-400" />}>
                                            <textarea name="labelingReqs" value={formState.labelingReqs} onChange={handleFormChange} rows={4} className="w-full pl-10 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"></textarea>
                                        </FormField>
                                    </div>
                                </div>
                            </fieldset>

                            <fieldset className="border-t pt-6">
                                <legend className="text-lg font-semibold text-gray-700 mb-4">Upload Documents</legend>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                                    <div className="space-y-1 text-center">
                                        <Package className="mx-auto h-12 w-12 text-gray-400" />
                                        <div className="flex text-sm text-gray-600">
                                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-purple-600 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500">
                                                <span>Upload files</span>
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple onChange={handleFileChange} ref={fileInputRef} />
                                            </label>
                                            <p className="pl-1">or drag and drop</p>
                                        </div>
                                        <p className="text-xs text-gray-500">PDF, AI, PSD, PNG, JPG up to 10MB</p>
                                    </div>
                                </div>
                                {files.length > 0 && (
                                <div className="mt-4">
                                    <h4 className="font-semibold text-gray-600">Uploaded files:</h4>
                                    <ul className="mt-2 space-y-2">
                                        {files.map((file, index) => (
                                            <li key={index} className="flex justify-between items-center bg-gray-100 p-2 rounded-md">
                                                <span className="text-sm text-gray-800 truncate">{file.name}</span>
                                                <button type="button" onClick={() => removeFile(file.name)} className="text-red-500 hover:text-red-700 text-sm font-semibold">Remove</button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                )}
                            </fieldset>
                            <div className="text-right pt-6 border-t"> <button type="submit" className="w-full md:w-auto px-8 py-3 text-white rounded-lg font-semibold bg-purple-600 hover:bg-purple-700 transition shadow-md"> Find Matching Factories </button> </div>
                        </form>
                    </div>
                </div>
            </MainLayout>
        );
    };

    const FactoryCard: FC<{ factory: Factory; onSelect: () => void; style: React.CSSProperties }> = React.memo(({ factory, onSelect, style }) => (
        <div onClick={onSelect} style={style} className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group flex flex-col animate-card-enter">
            <div className="relative">
                <img src={factory.imageUrl} alt={factory.name} className="h-48 w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).onerror = null; (e.target as HTMLImageElement).src=`https://placehold.co/600x400/e9d5ff/4c1d95?text=${factory.name}`; }} />
                {factory.offer && <div className="absolute top-0 left-0 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-br-xl shadow-lg uppercase">{factory.offer}</div>}
            </div>
            <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-bold text-lg text-gray-800 truncate mb-2">{factory.name}</h3>
                <div className="flex items-center text-sm text-gray-600 mb-3">
                    <div className="flex items-center bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded mr-2">
                        <Star size={14} className="mr-1 fill-current text-green-600" />
                        {factory.rating}
                    </div>
                    <span className="mx-1">·</span>
                    <div className="flex items-center">
                        <Clock size={14} className="mr-1.5" />
                        <span>{factory.turnaround}</span>
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-1 truncate flex items-center"><MapPin size={14} className="mr-1.5 flex-shrink-0"/> {factory.location}</p>
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
                    {factory.certifications?.slice(0,3).map(cert => (
                        <span key={cert} className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-800">{cert.split(' ')[0]}</span>
                    ))}
                </div>
            </div>
        </div>
    ));

    const FactorySuggestionsPage: FC = () => (
        <MainLayout pageKey={pageKey}>
            <div className="space-y-6">
                <div>
                    <button onClick={() => handleSetCurrentPage('orderForm')} className="text-purple-600 font-semibold mb-4 flex items-center hover:underline">
                        <ChevronLeft className="h-5 w-5 mr-1" />
                        Back to Order Form
                    </button>
                    <h2 className="text-3xl font-bold text-gray-800">Top Factory Matches</h2>
                    <p className="text-gray-500 mt-1">Based on your request for {orderFormData.qty} {orderFormData.category}s.</p>
                </div>
                {suggestedFactories.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {suggestedFactories.map((factory, index) => (
                            <FactoryCard
                                key={factory.id}
                                factory={factory}
                                onSelect={() => handleSelectFactory(factory)}
                                style={{animationDelay: `${index * 60}ms`}}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 bg-white rounded-lg shadow-md">
                        <h3 className="text-xl font-semibold text-gray-700">No factories match your criteria.</h3>
                        <p className="text-gray-500 mt-2">Try adjusting your product category in the order form.</p>
                    </div>
                )}
            </div>
        </MainLayout>
    );

   const FactoryDetailPage: FC = () => {
       if (!selectedFactory) return null;
       const CertificationBadge: FC<{ cert: string }> = ({ cert }) => {
           const certStyles: { [key: string]: string } = {
               'Sedex': 'bg-blue-100 text-blue-800',
               'Oeko-Tex Standard 100': 'bg-green-100 text-green-800',
               'BCI': 'bg-yellow-100 text-yellow-800',
               'WRAP': 'bg-indigo-100 text-indigo-800',
               'ISO 9001': 'bg-red-100 text-red-800'
           };
           return <span className={`text-sm font-semibold px-3 py-1 rounded-full ${certStyles[cert] || 'bg-gray-100 text-gray-800'}`}>{cert}</span>
       }
       const MachineSlot: FC<{ slot: MachineSlot }> = ({ slot }) => {
           const usagePercentage = (slot.availableSlots / slot.totalSlots) * 100;
           return (
               <tr className="hover:bg-gray-50">
                   <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{slot.machineType}</td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                       <div className="flex items-center">
                           <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                               <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${usagePercentage}%` }}></div>
                           </div>
                           <span>{slot.availableSlots}/{slot.totalSlots}</span>
                       </div>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{slot.nextAvailable}</td>
               </tr>
           )
       }
       return (
           <MainLayout pageKey={pageKey}>
               <div className="space-y-6">
                   <div>
                       <button onClick={() => handleSetCurrentPage(suggestedFactories.length > 0 ? 'factorySuggestions' : 'sourcing')} className="text-purple-600 font-semibold mb-4 flex items-center hover:underline">
                           <ChevronLeft className="h-5 w-5 mr-1" />
                           Back to Factories
                       </button>
                   </div>
                   <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                       <div className="md:flex">
                           <div className="md:flex-shrink-0">
                               <img className="h-64 w-full object-cover md:w-64" src={selectedFactory.imageUrl} alt={selectedFactory.name} />
                           </div>
                           <div className="p-8 flex-grow">
                               <h1 className="text-3xl font-bold text-gray-900">{selectedFactory.name}</h1>
                               <div className="flex flex-wrap gap-2 mt-2 mb-4">
                                   {selectedFactory.tags?.map(tag => (
                                       <span key={tag} className={`text-sm font-semibold px-3 py-1 rounded-full ${ tag === 'Prime' ? 'bg-blue-100 text-blue-800' : tag === 'Tech Enabled' ? 'bg-purple-100 text-purple-800' : tag === 'Sustainable' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800' }`}>
                                           {tag}
                                       </span>
                                   ))}
                               </div>
                               <p className="mt-2 text-gray-600">{selectedFactory.description}</p>
                           </div>
                       </div>
                       <div className="px-8 py-6 border-t border-gray-200">
                           <h3 className="text-xl font-bold text-gray-800 mb-4">Factory Details</h3>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                               <div> <p className="text-sm font-medium text-gray-500">Location</p> <p className="font-semibold text-gray-800 flex items-center justify-center"><MapPin size={14} className="mr-1.5"/>{selectedFactory.location}</p> </div>
                               <div> <p className="text-sm font-medium text-gray-500">Rating</p> <p className="font-semibold text-gray-800 flex items-center justify-center"><Star size={16} className="text-yellow-400 fill-current mr-1.5"/>{selectedFactory.rating}</p> </div>
                               <div> <p className="text-sm font-medium text-gray-500">MOQ</p> <p className="font-semibold text-gray-800">{selectedFactory.minimumOrderQuantity} units</p> </div>
                               <div> <p className="text-sm font-medium text-gray-500">Specialties</p> <p className="font-semibold text-gray-800">{selectedFactory.specialties.join(', ')}</p> </div>
                           </div>
                       </div>
                       <div className="px-8 py-6 border-t border-gray-200">
                           <h3 className="text-xl font-bold text-gray-800 mb-4">Certifications & Compliance</h3>
                           <div className="flex flex-wrap gap-3">
                               {selectedFactory.certifications?.map(cert => <CertificationBadge key={cert} cert={cert} />)}
                           </div>
                       </div>
                       <div className="px-8 py-6 border-t border-gray-200">
                           <h3 className="text-xl font-bold text-gray-800 mb-4">Production Capacity</h3>
                           <div className="overflow-x-auto">
                               <table className="min-w-full divide-y divide-gray-200">
                                   <thead className="bg-gray-50">
                                       <tr>
                                           <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Machine Type</th>
                                           <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available Capacity</th>
                                           <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Available Date</th>
                                       </tr>
                                   </thead>
                                   <tbody className="bg-white divide-y divide-gray-200">
                                       {selectedFactory.machineSlots.map(slot => (
                                           <MachineSlot key={slot.machineType} slot={slot} />
                                       ))}
                                   </tbody>
                               </table>
                           </div>
                       </div>
                       <div className="px-8 py-6 bg-gray-50 flex flex-col md:flex-row items-center justify-between gap-4">
                           <div>
                               <h4 className="font-semibold text-gray-800">Ready to proceed?</h4>
                               <p className="text-sm text-gray-600">Request a quote or use our AI tools to prepare your inquiry.</p>
                           </div>
                           <div className="flex items-center gap-2">
                               <button onClick={() => handleSetCurrentPage('factoryTools')} className="w-full md:w-auto px-6 py-3 text-purple-700 bg-purple-100 rounded-lg font-semibold hover:bg-purple-200 transition">
                                   Use AI Sourcing Tools
                               </button>
                               <button onClick={() => handleSetCurrentPage('quoteRequest', selectedFactory)} className="w-full md:w-auto px-6 py-3 text-white rounded-lg font-semibold bg-purple-600 hover:bg-purple-700 transition shadow-md">
                                   Request a Quote
                               </button>
                           </div>
                       </div>
                   </div>
               </div>
           </MainLayout>
       );
   };

    const FactoryToolsPage: FC = () => {
        if (!selectedFactory) {
            handleSetCurrentPage('sourcing');
            return null;
        }
        return (
            <MainLayout pageKey={pageKey}>
                <div className="space-y-8">
                    <div>
                        <button onClick={() => handleSetCurrentPage('factoryDetail')} className="text-purple-600 font-semibold mb-4 flex items-center hover:underline">
                            <ChevronLeft className="h-5 w-5 mr-1" />
                            Back to Factory Details
                        </button>
                        <h2 className="text-3xl font-bold text-gray-800">AI Sourcing Tools for {selectedFactory.name}</h2>
                        <p className="text-gray-500 mt-1">Generate documents and get insights for your order.</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Your Order Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div> <label className="block text-sm font-medium text-gray-700 mb-1">Product Category</label> <p className="w-full p-2 border border-gray-200 rounded-md bg-gray-50">{orderFormData.category}</p> </div>
                            <div> <label className="block text-sm font-medium text-gray-700 mb-1">Order Quantity</label> <p className="w-full p-2 border border-gray-200 rounded-md bg-gray-50">{orderFormData.qty} units</p> </div>
                            <div className="md:col-span-2"> <label className="block text-sm font-medium text-gray-700 mb-1">Fabric & Style Details</label> <p className="w-full p-2 border border-gray-200 rounded-md bg-gray-50">{`${orderFormData.fabricQuality}, ${orderFormData.weightGSM}GSM, ${orderFormData.styleOption}`}</p> </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <AiCard icon={<ThumbsUp className="mr-2 text-purple-500"/>} title="Generate Contract Brief">
                            <div className="flex-grow min-h-[150px] prose prose-sm max-w-none whitespace-pre-wrap">{isLoadingBrief ? <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div></div> : contractBrief || <p className="text-gray-500 not-prose">Generate a professional brief to share with the factory.</p>}</div>
                            <button onClick={generateContractBrief} disabled={isLoadingBrief} className="mt-4 w-full px-5 py-2 text-sm text-white rounded-lg font-semibold bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50">
                                {isLoadingBrief ? 'Generating...' : 'Generate Brief'}
                            </button>
                        </AiCard>
                        <AiCard icon={<MessageSquare className="mr-2 text-purple-500"/>} title="Draft Outreach Email">
                            <div className="flex-grow min-h-[150px] prose prose-sm max-w-none whitespace-pre-wrap">{isLoadingEmail ? <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div></div> : outreachEmail || <p className="text-gray-500 not-prose">First, generate a contract brief.</p>}</div>
                            {outreachEmail && !isLoadingEmail && <button onClick={() => copyToClipboard(outreachEmail, 'Email content copied!')} className="mt-4 w-full px-5 py-2 text-sm text-indigo-700 rounded-lg font-semibold bg-indigo-100 hover:bg-indigo-200 transition flex items-center justify-center"><ClipboardCopy size={16} className="mr-2"/>Copy Email</button>}
                            <button onClick={generateOutreachEmail} disabled={isLoadingEmail || !contractBrief || !selectedFactory} className="mt-2 w-full px-5 py-2 text-sm text-white rounded-lg font-semibold bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50">
                                {isLoadingEmail ? 'Drafting...' : 'Draft Email'}
                            </button>
                        </AiCard>
                        <AiCard icon={<BrainCircuit className="mr-2 text-purple-500"/>} title="Suggest Optimizations">
                            <div className="flex-grow min-h-[150px] prose prose-sm max-w-none whitespace-pre-wrap">{isLoadingOptimizations ? <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div></div> : optimizationSuggestions || <p className="text-gray-500 not-prose">Find ways to improve cost, quality, or sustainability.</p>}</div>
                            <button onClick={suggestOptimizations} disabled={isLoadingOptimizations} className="mt-4 w-full px-5 py-2 text-sm text-white rounded-lg font-semibold bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50">
                                {isLoadingOptimizations ? 'Analyzing...' : 'Get Suggestions'}
                            </button>
                        </AiCard>
                        <AiCard icon={<BadgePercent className="mr-2 text-purple-500"/>} title="Negotiation Advisor">
                            <div className="flex-grow min-h-[150px] prose prose-sm max-w-none whitespace-pre-wrap">{isLoadingNegotiation ? <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div></div> : negotiationTips || <p className="text-gray-500 not-prose">Get AI-powered negotiation points and cultural tips.</p>}</div>
                            <button onClick={getNegotiationTips} disabled={isLoadingNegotiation} className="mt-4 w-full px-5 py-2 text-sm text-white rounded-lg font-semibold bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50">
                                {isLoadingNegotiation ? 'Advising...' : 'Get Negotiation Tips'}
                            </button>
                        </AiCard>
                    </div>
                </div>
            </MainLayout>
        );
    };

    const CRMPage: FC = () => {
        const crmData = useMemo(() => ({
            "PO-2024-001": { customer: 'Acme Corp', product: '5000 Classic Tees', factoryId: 'F001', tasks: [ { id: 1, name: 'Sample Approval', responsible: 'Jane D.', plannedStartDate: '2025-11-01', plannedEndDate: '2025-11-05', actualStartDate: '2025-11-01', actualEndDate: '2025-11-04', status: 'COMPLETE', color: 'bg-purple-500', quantity: 10 }, { id: 2, name: 'Fabric Sourcing', responsible: 'Merch Team', plannedStartDate: '2025-11-03', plannedEndDate: '2025-11-10', actualStartDate: '2025-11-04', actualEndDate: '2025-11-09', status: 'COMPLETE', color: 'bg-blue-500', quantity: 5000 }, { id: 3, name: 'Cutting', responsible: 'Prod. Team', plannedStartDate: '2025-11-11', plannedEndDate: '2025-11-15', actualStartDate: '2025-11-11', actualEndDate: null, status: 'IN PROGRESS', color: 'bg-pink-500', quantity: 5000 }, { id: 4, name: 'Stitching', responsible: 'Prod. Team', plannedStartDate: '2025-11-16', plannedEndDate: '2025-11-25', actualStartDate: '2025-11-18', actualEndDate: null, status: 'IN PROGRESS', color: 'bg-orange-500', quantity: 2500 }, { id: 5, name: 'Quality Check', responsible: 'QA Team', plannedStartDate: '2025-11-26', plannedEndDate: '2025-11-28', actualStartDate: null, actualEndDate: null, status: 'TO DO', color: 'bg-green-500', quantity: 0 }, { id: 6, name: 'Packing & Shipping', responsible: 'Logistics', plannedStartDate: '2025-11-29', plannedEndDate: '2025-12-02', actualStartDate: null, actualEndDate: null, status: 'TO DO', color: 'bg-yellow-500', quantity: 0 }, ] },
            "PO-2024-002": { customer: 'Stark Industries', product: '10000 Hoodies', factoryId: 'F003', tasks: [ { id: 7, name: 'Fabric Sourcing', responsible: 'Merch Team', plannedStartDate: '2025-12-01', plannedEndDate: '2025-12-10', actualStartDate: '2025-12-02', actualEndDate: '2025-12-10', status: 'COMPLETE', color: 'bg-blue-500', quantity: 10000 }, { id: 8, name: 'Lab Dips', responsible: 'Jane D.', plannedStartDate: '2025-12-05', plannedEndDate: '2025-12-12', actualStartDate: '2025-12-06', actualEndDate: null, status: 'IN PROGRESS', color: 'bg-pink-500', quantity: 20 }, { id: 9, name: 'Production', responsible: 'Prod. Team', plannedStartDate: '2025-12-13', plannedEndDate: '2026-01-05', actualStartDate: null, actualEndDate: null, status: 'TO DO', color: 'bg-green-500', quantity: 0 }, ] },
            "PO-2024-003": { customer: 'Wayne Enterprises', product: '2500 Jackets', factoryId: 'F004', tasks: [ { id: 10, name: 'Order Confirmation', responsible: 'Admin', plannedStartDate: '2025-08-01', plannedEndDate: '2025-08-01', actualStartDate: '2025-08-01', actualEndDate: '2025-08-01', status: 'COMPLETE' }, { id: 11, name: 'Fit Sample', responsible: 'Tech Team', plannedStartDate: '2025-08-05', plannedEndDate: '2025-08-10', actualStartDate: '2025-08-06', actualEndDate: '2025-08-11', status: 'COMPLETE' }, { id: 12, name: 'Fabric Approval', responsible: 'Merch Team', plannedStartDate: '2025-08-12', plannedEndDate: '2025-08-15', actualStartDate: '2025-08-12', actualEndDate: null, status: 'IN PROGRESS' }, { id: 13, name: 'Bulk Production', responsible: 'Prod. Team', plannedStartDate: '2025-08-16', plannedEndDate: '2025-09-10', actualStartDate: null, actualEndDate: null, status: 'TO DO' }, { id: 14, name: 'Midline Inspection', responsible: 'QA Team', plannedStartDate: '2025-08-30', plannedEndDate: '2025-08-31', actualStartDate: null, actualEndDate: null, status: 'TO DO' }, { id: 15, name: 'Final Inspection', responsible: 'QA Team', plannedStartDate: '2025-09-11', plannedEndDate: '2025-09-12', actualStartDate: null, actualEndDate: null, status: 'TO DO' }, { id: 16, name: 'Shipment', responsible: 'Logistics', plannedStartDate: '2025-09-15', plannedEndDate: '2025-09-15', actualStartDate: null, actualEndDate: null, status: 'TO DO' }, ] }
        }), []);

        const [activeOrderKey, setActiveOrderKey] = useState(Object.keys(crmData)[0]);
        const [activeView, setActiveView] = useState('Details');
        const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
        const [orderSummary, setOrderSummary] = useState('');
        const [isSummaryLoading, setIsSummaryLoading] = useState(false);

        const activeOrder = crmData[activeOrderKey];

        const generateOrderSummary = async () => {
            setIsSummaryModalOpen(true);
            setIsSummaryLoading(true);
            setOrderSummary('');
            const prompt = `Provide a concise, structured summary for the garment production order: ${activeOrderKey}. The customer is ${activeOrder.customer} and the product is ${activeOrder.product}. Here are the current task statuses: ${activeOrder.tasks.map(t => `- ${t.name}: ${t.status} (Due: ${t.plannedEndDate})`).join('\n')} Based on this data, generate a summary in the following markdown-like format using these exact prefixes: H3:Order Progress Summary: ${activeOrderKey}\nB:**Overall Status:**\nP:*Provide a one-sentence overview of the order's health. Mention the percentage of tasks completed.*\nB:**Current Focus:**\nP:*Describe what is actively being worked on (tasks in progress).*\nB:**Upcoming Milestones:**\nUL:*List the next 2-3 important tasks from the 'TO DO' list, one item per line.*\nB:**Potential Risks:**\nP:*Identify any potential risks. If no risks, state "No immediate risks identified."*`;
            try {
                const summary = await callGeminiAPI(prompt);
                setOrderSummary(summary);
            } catch (error) {
                console.error("Failed to generate order summary:", error);
                setOrderSummary("H3:Error\nP:Sorry, I was unable to generate a summary at this time. Please try again later.");
                showToast("Error generating summary.", "error");
            } finally {
                setIsSummaryLoading(false);
            }
        };

        const MarkdownRenderer: FC<{ text: string }> = ({ text }) => {
            if (!text) return null;
            const lines = text.split('\n').map(line => line.trim()).filter(line => line);
            const renderLine = (line: string) => {
                if (line.startsWith('H3:')) return <h3 className="text-xl font-bold text-gray-800 mb-4">{line.substring(3)}</h3>;
                if (line.startsWith('B:')) return <p className="font-semibold text-gray-700 mt-4 mb-1">{line.substring(2)}</p>;
                if (line.startsWith('P:')) return <p className="text-gray-600">{line.substring(2)}</p>;
                if (line.startsWith('UL:')) {
                    return ( <li className="flex items-start my-1 text-gray-600"> <span className="mr-3 mt-1.5 text-purple-500">∙</span> <span>{line.substring(3)}</span> </li> );
                }
                return <p>{line}</p>;
            };
            return ( <div className="space-y-1"> {lines.map((line, index) => <div key={index}>{renderLine(line)}</div>)} </div> );
        };

        const AIOrderSummaryModal: FC = () => (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={() => setIsSummaryModalOpen(false)}>
                <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-2xl relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setIsSummaryModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"> <X size={24} /> </button>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-purple-100 rounded-lg"> <Bot className="w-6 h-6 text-purple-600" /> </div>
                        <h2 className="text-2xl font-bold text-gray-800">AI Order Summary</h2>
                    </div>
                    <div className="min-h-[200px]">
                        {isSummaryLoading ? ( <div className="flex items-center justify-center h-full flex-col"> <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div> <p className="mt-4 text-gray-500">Analyzing order data...</p> </div> ) : ( <MarkdownRenderer text={orderSummary} /> )}
                    </div>
                </div>
            </div>
        );

        const DashboardCard: FC<{ icon: ReactNode; title: string; value: string | number; colorClass: string }> = ({ icon, title, value, colorClass }) => (
            <div className={`relative p-5 rounded-xl overflow-hidden bg-white shadow-sm border`}>
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">{title}</p>
                        <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${colorClass}`}>
                        {icon}
                    </div>
                </div>
            </div>
        );

        const DashboardView: FC<{ tasks: any[]; orderKey: string; orderDetails: any }> = ({ tasks, orderKey, orderDetails }) => {
            const statusData = useMemo(() => {
                const statuses: { [key: string]: number } = { 'TO DO': 0, 'IN PROGRESS': 0, 'COMPLETE': 0 };
                tasks.forEach(task => {
                    if(statuses[task.status] !== undefined) statuses[task.status]++;
                });
                return Object.entries(statuses).map(([name, value]) => ({ name, value }));
            }, [tasks]);

            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(t => t.status === 'COMPLETE').length;
            const inProgressTasks = tasks.filter(t => t.status === 'IN PROGRESS').length;
            const totalQuantity = parseInt(orderDetails.product.split(' ')[0], 10);
            const COLORS = ['#D1D5DB', '#FBBF24', '#34D399'];

            return (
                <div className="mt-6 space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <DashboardCard title="Total Tasks" value={totalTasks} icon={<List className="text-purple-800"/>} colorClass="bg-purple-100" />
                        <DashboardCard title="In Progress" value={inProgressTasks} icon={<TrendingUp className="text-yellow-800"/>} colorClass="bg-yellow-100" />
                        <DashboardCard title="Completed" value={completedTasks} icon={<CheckCircle className="text-green-800"/>} colorClass="bg-green-100" />
                        <DashboardCard title="Total Quantity" value={totalQuantity.toLocaleString()} icon={<Package className="text-blue-800"/>} colorClass="bg-blue-100" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><PieChartIcon size={20} className="mr-2 text-purple-600"/>Task Status Distribution</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie data={statusData} cx="50%" cy="50%" labelLine={false} innerRadius={70} outerRadius={110} fill="#8884d8" dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                        {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="focus:outline-none" />)}
                                    </Pie>
                                    <Tooltip/>
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><BarChartIcon size={20} className="mr-2 text-purple-600"/>Units Per Task</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={tasks.filter(t => t.quantity > 0)} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.8}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{fontSize: 12}} />
                                    <YAxis tick={{fontSize: 12}} />
                                    <Tooltip />
                                    <Bar dataKey="quantity" fill="url(#colorUv)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )
        };

        const ListView: FC<{ tasks: any[] }> = ({ tasks }) => {
            const completedTasks = tasks.filter(t => t.status === 'COMPLETE');
            const todoTasks = tasks.filter(t => t.status === 'TO DO');
            const inProgressTasks = tasks.filter(t => t.status === 'IN PROGRESS');
            const calculateTotals = (tasks: any[]) => {
                return tasks.reduce((acc, task) => {
                    acc.qty += task.quantity || 0;
                    return acc;
                }, { qty: 0 });
            }
            const totals = calculateTotals(completedTasks);

            const TaskGroup: FC<{ title: string; tasks: any[]; showTotals?: boolean; totalsData?: any }> = ({ title, tasks, showTotals, totalsData }) => {
                const isCompletedGroup = title === 'COMPLETE';
                const groupHeaderColor = isCompletedGroup ? 'text-green-600' : 'text-gray-600';
                return (
                    <div className="mb-8">
                        <div className="flex items-center text-sm font-semibold mb-3">
                            <ChevronDown size={20} className={`mr-1 ${groupHeaderColor}`} />
                            <span className={`mr-2 ${groupHeaderColor}`}>{title}</span>
                            <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full">{tasks.length}</span>
                            <button className="ml-4 text-gray-500 hover:text-gray-800 flex items-center gap-1">
                                <Plus size={16} /> Add Task
                            </button>
                        </div>
                        <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {['Task Name', 'Due date', 'QTY'].map(header => (
                                            <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {tasks.map(task => (
                                        <tr key={task.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-900 flex items-center">
                                                <CheckCircle size={16} className={`${task.status === 'COMPLETE' ? 'text-green-500' : 'text-gray-300'} mr-2`} /> {task.name}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-gray-600">{task.plannedEndDate}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-gray-600">{task.quantity?.toLocaleString() || 'N/A'}</td>
                                        </tr>
                                    ))}
                                    {showTotals && (
                                    <tr className="bg-gray-50 font-bold">
                                        <td className="px-4 py-2 text-gray-800"></td>
                                        <td className="px-4 py-2 text-gray-800"></td>
                                        <td className="px-4 py-2 text-gray-800">{totalsData.qty.toLocaleString()}</td>
                                    </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            }

            return (
                <div className="mt-6 animate-fade-in">
                    <TaskGroup title="COMPLETE" tasks={completedTasks} showTotals={true} totalsData={totals} />
                    {inProgressTasks.length > 0 && <TaskGroup title="IN PROGRESS" tasks={inProgressTasks} />}
                    {todoTasks.length > 0 && <TaskGroup title="TO DO" tasks={todoTasks} />}
                </div>
            );
        };

        const BoardView: FC<{ tasks: any[] }> = ({ tasks }) => {
            const columns: { [key: string]: any[] } = {
                'TO DO': tasks.filter(t => t.status === 'TO DO'),
                'IN PROGRESS': tasks.filter(t => t.status === 'IN PROGRESS'),
                'COMPLETE': tasks.filter(t => t.status === 'COMPLETE'),
            };

            const TaskCard: FC<{ task: any }> = ({ task }) => (
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm mb-3">
                    <p className="font-semibold text-sm text-gray-800">{task.name}</p>
                    <p className="text-xs text-gray-500 mt-1">Due: {task.plannedEndDate}</p>
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex -space-x-2">
                            <img className="w-6 h-6 rounded-full border-2 border-white" src={`https://i.pravatar.cc/150?u=${task.responsible}`} alt="user"/>
                        </div>
                        <span className={`w-10 h-2 rounded-full ${task.color}`}></span>
                    </div>
                </div>
            )

            return (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                    {Object.entries(columns).map(([status, tasksInColumn]) => (
                        <div key={status} className="bg-gray-50/70 p-3 rounded-lg">
                            <h3 className="flex items-center justify-between text-sm font-semibold mb-4 px-1 text-gray-700">
                                <span>{status}</span>
                                <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full">{tasksInColumn.length}</span>
                            </h3>
                            <div>
                                {tasksInColumn.map(task => <TaskCard key={task.id} task={task} />)}
                                <button className="w-full text-left text-sm font-medium text-gray-500 hover:bg-gray-200 p-2 rounded-md flex items-center">
                                    <Plus size={16} className="mr-1"/> Add Task
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )
        }

        const GanttChartView: FC<{ tasks: any[] }> = ({ tasks }) => {
            const parseDate = (str: string) => new Date(str);
            const diffDays = (date1: Date, date2: Date) => Math.ceil(Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));

            const { timelineStart, timelineEnd, totalDuration } = useMemo(() => {
                if (!tasks || tasks.length === 0) {
                    const today = new Date();
                    return { timelineStart: today, timelineEnd: new Date(new Date().setDate(today.getDate() + 30)), totalDuration: 30 };
                }
                const startDates = tasks.map(t => parseDate(t.plannedStartDate));
                const endDates = tasks.map(t => parseDate(t.plannedEndDate));
                const minDate = new Date(Math.min.apply(null, startDates.map(d => d.getTime())));
                const maxDate = new Date(Math.max.apply(null, endDates.map(d => d.getTime())));
                minDate.setDate(minDate.getDate() - 2); // buffer
                maxDate.setDate(maxDate.getDate() + 2); // buffer
                return {
                    timelineStart: minDate,
                    timelineEnd: maxDate,
                    totalDuration: diffDays(minDate, maxDate),
                };
            }, [tasks]);

            const timelineHeader = useMemo(() => {
                const header: Date[] = [];
                let current = new Date(timelineStart);
                while(current <= timelineEnd) {
                    header.push(new Date(current));
                    current.setDate(current.getDate() + 1);
                }
                return header;
            }, [timelineStart, timelineEnd]);

            return (
                <div className="mt-6 overflow-x-auto scrollbar-hide animate-fade-in">
                    <div className="relative" style={{ minWidth: `${totalDuration * 40}px`}}>
                        {/* Grid Lines & Header */}
                        <div className="relative grid border-b-2 border-gray-200" style={{ gridTemplateColumns: `repeat(${totalDuration}, minmax(40px, 1fr))`}}>
                            {timelineHeader.map((date, i) => (
                                <div key={i} className="text-center border-r border-gray-200 py-2">
                                    <p className="text-xs text-gray-500">{date.toLocaleDateString('en-US', {month: 'short'})}</p>
                                    <p className="text-sm font-medium text-gray-800">{date.getDate()}</p>
                                </div>
                            ))}
                        </div>
                        {/* Task Bars */}
                        <div className="relative mt-4 space-y-2">
                            {tasks.map((task, index) => {
                                const taskStart = parseDate(task.plannedStartDate);
                                const taskEnd = parseDate(task.plannedEndDate);
                                const offset = diffDays(timelineStart, taskStart);
                                const duration = diffDays(taskStart, taskEnd) + 1;
                                const left = (offset / totalDuration) * 100;
                                const width = (duration / totalDuration) * 100;
                                return (
                                    <div key={task.id} className="absolute w-full h-10 flex items-center" style={{ top: `${index * 48}px`, left: `${left}%`, width: `${width}%` }}>
                                        <div className={`w-full h-8 rounded-full flex items-center justify-between px-3 text-white shadow-md ${task.color || 'bg-gray-400'}`}>
                                            <span className="text-sm font-medium truncate">{task.name}</span>
                                            <img className="w-6 h-6 rounded-full border-2 border-white flex-shrink-0" src={`https://i.pravatar.cc/150?u=${task.id}`} alt="user"/>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div style={{height: `${tasks.length * 48}px`}}></div>
                    </div>
                </div>
            )
        }

        const TNAView: FC<{ tasks: any[] }> = ({ tasks }) => {
            const parseDate = (str: string | null) => str ? new Date(str) : null;
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize today's date

            const calculateDelay = (task: any) => {
                const plannedEnd = parseDate(task.plannedEndDate);
                if (!plannedEnd) return { days: 0, status: 'ontime' };

                if (task.status === 'COMPLETE') {
                    const actualEnd = parseDate(task.actualEndDate);
                    if (!actualEnd) return { days: 0, status: 'ontime' };
                    const delay = Math.ceil((actualEnd.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24));
                    return { days: delay, status: delay > 0 ? 'delayed' : 'ontime' };
                } else {
                    if (today > plannedEnd) {
                        const delay = Math.ceil((today.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24));
                        return { days: delay, status: 'at-risk' };
                    }
                }
                return { days: 0, status: 'ontime' };
            };

            const getDelayColor = (status: string) => {
                if (status === 'delayed') return 'text-red-600 font-semibold';
                if (status === 'at-risk') return 'text-yellow-600 font-semibold';
                return 'text-green-600 font-semibold';
            };

            const getStatusPill = (status: string) => {
                const baseClasses = "px-2 inline-flex text-xs leading-5 font-semibold rounded-full";
                switch(status) {
                    case 'COMPLETE': return `${baseClasses} bg-green-100 text-green-800`;
                    case 'IN PROGRESS': return `${baseClasses} bg-blue-100 text-blue-800`;
                    case 'TO DO': return `${baseClasses} bg-gray-100 text-gray-800`;
                    default: return `${baseClasses} bg-gray-100 text-gray-800`;
                }
            }

            return (
                <div className="mt-6 overflow-x-auto animate-fade-in">
                    <div className="bg-white rounded-xl shadow-sm border">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {['Task', 'Responsible', 'Planned Start', 'Planned End', 'Actual Start', 'Actual End', 'Status', 'Delay (Days)'].map(header => (
                                        <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                {tasks.map(task => {
                                    const delayInfo = calculateDelay(task);
                                    return (
                                        <tr key={task.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">{task.name}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-600">{task.responsible}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-600">{task.plannedStartDate}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-600">{task.plannedEndDate}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-600">{task.actualStartDate || '—'}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-600">{task.actualEndDate || '—'}</td>
                                            <td className="px-4 py-3 whitespace-nowrap"><span className={getStatusPill(task.status)}>{task.status}</span></td>
                                            <td className={`px-4 py-3 whitespace-nowrap ${getDelayColor(delayInfo.status)}`}>{delayInfo.days > 0 ? `+${delayInfo.days}` : '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )
        };

        const OrderDetailsView: FC<{ order: any }> = ({ order }) => {
            const factory = allFactories.find(f => f.id === order.factoryId);
            return (
                <div className="mt-6 space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">Order Summary</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div><p className="text-sm text-gray-500">Order ID</p><p className="font-semibold">{activeOrderKey}</p></div>
                                    <div><p className="text-sm text-gray-500">Customer</p><p className="font-semibold">{order.customer}</p></div>
                                    <div><p className="text-sm text-gray-500">Product</p><p className="font-semibold">{order.product}</p></div>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">Documents & Specifications</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer">
                                        <div>
                                            <p className="font-semibold">Tech Pack</p>
                                            <p className="text-xs text-gray-500">v1.2 - Updated 2 days ago</p>
                                        </div>
                                        <FileText className="text-purple-600" />
                                    </div>
                                    <div className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer">
                                        <div>
                                            <p className="font-semibold">Spec Chart</p>
                                            <p className="text-xs text-gray-500">All sizes included</p>
                                        </div>
                                        <FileText className="text-purple-600" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Right Column */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Assigned Factory</h3>
                            {factory ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <img src={factory.imageUrl} alt={factory.name} className="w-16 h-16 rounded-lg object-cover"/>
                                        <div>
                                            <p className="font-bold text-gray-900">{factory.name}</p>
                                            <p className="text-sm text-gray-500 flex items-center"><MapPin size={14} className="mr-1.5"/>{factory.location}</p>
                                        </div>
                                    </div>
                                    <div className="text-sm space-y-2">
                                        <p><span className="font-semibold">Rating:</span> {factory.rating} / 5.0</p>
                                        <p><span className="font-semibold">Specialties:</span> {factory.specialties.join(', ')}</p>
                                        <p><span className="font-semibold">Contact:</span> john.doe@example.com</p>
                                    </div>
                                    <button className="w-full mt-2 py-2 px-4 text-sm font-semibold bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200">View Factory Profile</button>
                                </div>
                            ) : <p>No factory assigned.</p>}
                        </div>
                    </div>
                </div>
            )
        }

        return (
            <MainLayout pageKey={pageKey}>
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">CRM Portal</h1>
                    <button className="bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-purple-700 transition">
                        <Plus size={18} /> Add Task
                    </button>
                </div>
                <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                    <div className="border-b border-gray-200 pb-4">
                        <div className="flex flex-wrap items-center justify-between gap-y-4 gap-x-2">
                            {/* Order Tabs */}
                            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                                {Object.keys(crmData).map(orderKey => (
                                    <button key={orderKey} onClick={() => setActiveOrderKey(orderKey)} className={`flex-shrink-0 py-2 px-4 font-semibold text-sm rounded-t-lg transition-colors ${activeOrderKey === orderKey ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                        {crmData[orderKey].product}
                                    </button>
                                ))}
                            </div>
                            {/* View Tabs & AI Button */}
                            <div className="flex items-center gap-2">
                                <div className="flex items-center border border-gray-200 rounded-lg p-1 bg-gray-50">
                                    {[
                                        {name: 'Details', icon: <Info size={16}/>},
                                        {name: 'List', icon: <List size={16}/>},
                                        {name: 'Board', icon: <LayoutDashboard size={16}/>},
                                        {name: 'TNA', icon: <ClipboardCheck size={16}/>},
                                        {name: 'Dashboard', icon: <PieChartIcon size={16}/>},
                                        {name: 'Gantt', icon: <GanttChartSquare size={16}/>}
                                    ].map(view => (
                                        <button key={view.name} onClick={() => setActiveView(view.name)} className={`flex items-center gap-2 py-1.5 px-3 text-sm font-semibold rounded-md transition-colors ${activeView === view.name ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>
                                            {view.icon} <span className="hidden sm:inline">{view.name}</span>
                                        </button>
                                    ))}
                                </div>
                                <button onClick={generateOrderSummary} className="p-2.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors" title="Generate AI Summary">
                                    <Bot size={18}/>
                                </button>
                            </div>
                        </div>
                    </div>
                    {activeView === 'Details' && <OrderDetailsView order={activeOrder} />}
                    {activeView === 'List' && <ListView tasks={activeOrder.tasks} />}
                    {activeView === 'Board' && <BoardView tasks={activeOrder.tasks} />}
                    {activeView === 'TNA' && <TNAView tasks={activeOrder.tasks} />}
                    {activeView === 'Dashboard' && <DashboardView tasks={activeOrder.tasks} orderKey={activeOrderKey} orderDetails={activeOrder}/>}
                    {activeView === 'Gantt' && <GanttChartView tasks={activeOrder.tasks} />}
                </div>
                {isSummaryModalOpen && <AIOrderSummaryModal />}
            </MainLayout>
        );
    };

    const OrderTrackingPage: FC = () => {
        const trackingData: { [key: string]: any[] } = {
            "PO-2024-001": [ { status: 'In Production', date: 'June 15, 2025', isComplete: true, icon: <PackageCheck/> }, { status: 'Quality Checked', date: 'June 20, 2025', isComplete: true, icon: <CheckCircle/> }, { status: 'Transport to Origin Port', date: 'June 22, 2025', isComplete: true, icon: <Truck/> }, { status: 'In Transit', date: 'June 25, 2025', isComplete: false, isInProgress: true, icon: <Ship/> }, { status: 'Reached Destination Port', date: 'Est. July 10, 2025', isComplete: false, icon: <Anchor/> }, { status: 'Delivered', date: 'Est. July 12, 2025', isComplete: false, icon: <Warehouse/> }, ],
            "PO-2024-002": [ { status: 'In Production', date: 'June 18, 2025', isComplete: true, icon: <PackageCheck/> }, { status: 'Quality Checked', date: 'June 24, 2025', isComplete: false, isInProgress: true, icon: <CheckCircle/> }, { status: 'Transport to Origin Port', date: 'Est. June 26, 2025', isComplete: false, icon: <Truck/> }, { status: 'In Transit', date: 'Est. June 28, 2025', isComplete: false, icon: <Ship/> }, { status: 'Reached Destination Port', date: 'Est. July 15, 2025', isComplete: false, icon: <Anchor/> }, { status: 'Delivered', date: 'Est. July 17, 2025', isComplete: false, icon: <Warehouse/> }, ]
        };
        const [activeOrderKey, setActiveOrderKey] = useState(Object.keys(trackingData)[0]);
        const activeOrderTracking = trackingData[activeOrderKey];
        return (
            <MainLayout pageKey={pageKey}>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Order Tracking</h1>
                <p className="text-gray-500 mb-6">Follow your shipment from production to delivery.</p>
                <div className="bg-white rounded-xl shadow-lg">
                    <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                            {Object.keys(trackingData).map(orderKey => (
                                <button key={orderKey} onClick={() => setActiveOrderKey(orderKey)} className={`flex-shrink-0 py-2 px-4 font-semibold text-sm rounded-lg transition-colors ${activeOrderKey === orderKey ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100'}`}>
                                    {orderKey}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="p-6 sm:p-8">
                        <div className="relative pl-8">
                            {/* Vertical line */}
                            <div className="absolute left-12 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                            {activeOrderTracking.map((item, index) => {
                                const isLast = index === activeOrderTracking.length - 1;
                                const isComplete = item.isComplete;
                                const isInProgress = item.isInProgress;
                                return (
                                    <div key={index} className={`relative flex items-start ${isLast ? '' : 'pb-12'}`}>
                                        {/* Dot */}
                                        <div className="absolute left-12 top-1 -ml-[9px] h-5 w-5 rounded-full bg-white border-2 border-gray-300">
                                            {isComplete && <div className="w-full h-full rounded-full bg-purple-600 border-2 border-white"></div>}
                                            {isInProgress && <div className="w-full h-full rounded-full bg-white border-2 border-purple-600 animate-pulse"></div>}
                                        </div>
                                        {/* Content */}
                                        <div className="flex items-center gap-4 ml-8">
                                            <div className={`p-3 rounded-full ${
                                                isComplete ? 'bg-purple-100 text-purple-600' :
                                                isInProgress ? 'bg-blue-100 text-blue-600' :
                                                'bg-gray-100 text-gray-400'
                                            }`}>
                                                {item.icon}
                                            </div>
                                            <div>
                                                <h4 className={`font-semibold ${isComplete || isInProgress ? 'text-gray-800' : 'text-gray-500'}`}>{item.status}</h4>
                                                <p className="text-sm text-gray-500">{item.date}</p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </MainLayout>
        );
    };

    const AIChatSupport: FC = () => {
        const [isOpen, setIsOpen] = useState(false);
        const [messages, setMessages] = useState<{ text: string; sender: 'ai' | 'user'; isFormatted?: boolean }[]>([]);
        const [input, setInput] = useState('');
        const [isLoading, setIsLoading] = useState(false);
        const chatEndRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            if (isOpen && messages.length === 0) {
                setMessages([{ text: "Hello! I'm Auctave Brain. Ask me for an order summary or a platform tutorial.", sender: 'ai' }])
            }
        }, [isOpen, messages.length]);

        const handleSend = async () => {
            if (!input.trim()) return;
            const userMessage = { text: input, sender: 'user' };
            setMessages(prev => [...prev, userMessage]);
            const lowerInput = input.toLowerCase();
            setInput('');
            setIsLoading(true);

            const isTutorialRequest = lowerInput.includes('help') || lowerInput.includes('tutorial') || lowerInput.includes('how to');
            const orderContext = { 'PO-2024-001': { tasks: [ { id: 5, name: 'Quality Check', status: 'TO DO' }, { id: 6, name: 'Packing & Shipping', status: 'TO DO' }, { id: 3, name: 'Cutting', status: 'IN PROGRESS' }, { id: 4, name: 'Stitching', status: 'IN PROGRESS' }, ] } };
            const prompt = `You are "Auctave Brain," a helpful AI assistant for a garment sourcing platform. Your two primary functions are: 1. Summarizing order tasks. 2. Providing a platform tutorial. First, analyze the user's question: "${input}". If the user's question seems to be a request for help, a tutorial, or asks "how to use" the platform, provide the following tutorial. Format it *exactly* like this, using the specified prefixes: H1:Welcome to Auctave!\nP:Here’s a quick guide to get you started:\nH2:Key Features:\nLI:**Sourcing:** Find factories using search and filters.\nLI:**CRM Portal:** Manage orders with Details, List, Board, and Gantt views.\nLI:**Order Tracking:** See a live timeline of your shipment.\nLI:**AI Tools:** Ask me to 'summarize my order' to get AI-powered insights!\n\nOTHERWISE, if the user is asking for a summary or about tasks, analyze the following order data and provide a summary of tasks that are "TO DO" (as "Tasks Not Started") and tasks that are "IN PROGRESS". Format your response *exactly* like this, using the specified prefixes: Order Data: Tasks Not Started: ${orderContext['PO-2024-001'].tasks.filter(t => t.status === 'TO DO').map(t => t.name).join(', ')}. Tasks In Progress: ${orderContext['PO-2024-001'].tasks.filter(t => t.status === 'IN PROGRESS').map(t => t.name).join(', ')}. Example Summary Format: H1:Tasks Not Started\nP:[Number] tasks were recently updated but haven't been started yet.\nP:Tasks involve final checks and packaging.\nH2:Top Tasks:\nLI:Quality Check, Packing & Shipping\nH1:Tasks In Progress\nP:[Number] in progress tasks were updated recently.\nP:Tasks involve core production processes.\nH2:Top Tasks:\nLI:Cutting, Stitching`;

            try {
                let aiResponse: string;
                if (isTutorialRequest) {
                    aiResponse = `H1:Welcome to Auctave!\nP:Here’s a quick guide to get you started:\nH2:Key Features:\nLI:**Sourcing:** Find factories using search and filters.\nLI:**CRM Portal:** Manage orders with Details, List, Board, and Gantt views.\nLI:**Order Tracking:** See a live timeline of your shipment.\nLI:**AI Tools:** Ask me to 'summarize my order' to get AI-powered insights!`;
                } else {
                    aiResponse = await callGeminiAPI(prompt);
                }
                setMessages(prev => [...prev, { text: aiResponse, sender: 'ai', isFormatted: true }]);
            } catch (error) {
                setMessages(prev => [...prev, { text: "Sorry, I couldn't fetch that information. Please try again.", sender: 'ai' }]);
            } finally {
                setIsLoading(false);
            }
        };

        const FormattedMessage: FC<{ text: string }> = ({ text }) => {
            const lines = text.split('\n').filter(line => line.trim() !== '');
            const renderFormattedLine = (line: string) => {
                const parts = line.split(/(\*\*.*?\*\*)/g);
                return parts.map((part, i) =>
                    part.startsWith('**') && part.endsWith('**') ?
                    <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> :
                    part
                );
            }
            return (
                <div className="prose prose-sm max-w-none text-gray-800">
                    {lines.map((line, index) => {
                        if (line.startsWith('H1:')) { return <h3 key={index} className="font-bold text-lg mt-4 mb-1">{line.substring(3)}</h3>; }
                        if (line.startsWith('P:')) { return <p key={index} className="my-1">{line.substring(2)}</p>; }
                        if (line.startsWith('H2:')) { return <h4 key={index} className="font-semibold mt-3 mb-2">{line.substring(3)}</h4>; }
                        if (line.startsWith('LI:')) {
                            const items = line.substring(3).split(', ');
                            return (
                                <ul key={index} className="pl-0 space-y-1 list-none">
                                    {items.map((item, i) => (
                                        <li key={i} className="flex items-start">
                                            <span className="w-2.5 h-2.5 bg-gray-300 rounded-sm mr-2.5 mt-1.5 flex-shrink-0"></span>
                                            <span className="bg-gray-100 px-2 py-0.5 rounded text-sm">{renderFormattedLine(item)}</span>
                                        </li>
                                    ))}
                                </ul>
                            );
                        }
                        return <p key={index}>{line}</p>;
                    })}
                </div>
            );
        };

        return (
            <>
                <button onClick={() => setIsOpen(!isOpen)} className="fixed bottom-24 md:bottom-6 right-6 bg-purple-600 text-white p-4 rounded-full shadow-lg hover:bg-purple-700 transition-transform hover:scale-110 z-50">
                    {isOpen ? <X className="h-8 w-8" /> : <Bot className="h-8 w-8" />}
                </button>
                {isOpen && (
                    <div className="fixed bottom-24 right-6 w-full max-w-sm h-[70vh] bg-white rounded-2xl shadow-2xl flex flex-col transition-all duration-300 z-50 animate-fade-in sm:bottom-6 sm:max-w-md">
                        <header className="p-4 flex items-center gap-2">
                            <div className="p-1.5 bg-purple-100 rounded-md">
                                <Bot className="w-5 h-5 text-purple-600" />
                            </div>
                            <h3 className="font-bold text-sm text-gray-800">Auctave Brain</h3>
                            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 ml-auto p-1"><X size={20} /></button>
                        </header>
                        <div className="flex-1 p-4 overflow-y-auto space-y-4">
                            {messages.map((msg, index) => (
                                <div key={index} className={`flex ${msg.sender === 'ai' ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-xs p-3 rounded-lg ${msg.sender === 'ai' ? 'bg-gray-100 text-gray-800' : 'bg-blue-500 text-white'}`}>
                                        {msg.isFormatted ? <FormattedMessage text={msg.text} /> : msg.text}
                                    </div>
                                </div>
                            ))}
                            {isLoading && <div className="flex justify-start"><div className="bg-gray-200 text-gray-800 p-3 rounded-lg">...</div></div>}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="p-2 border-t border-gray-200">
                            <div className="p-1 border rounded-lg flex items-center">
                                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="Tell AI what to do next" className="flex-1 p-2 text-sm border-none focus:outline-none focus:ring-0" />
                                <button onClick={handleSend} className="bg-gray-100 text-gray-500 p-2 rounded-lg hover:bg-gray-200 transition"><Send size={16} /></button>
                            </div>
                            <div className="flex items-center gap-2 mt-1 px-2">
                                <button className="p-1 text-gray-400 hover:text-gray-600"><Plus size={18}/></button>
                                <button className="p-1 text-gray-400 hover:text-gray-600"><Globe size={16}/></button>
                                <button className="text-xs flex items-center gap-1 text-gray-500 hover:text-gray-700">
                                    <Briefcase size={14}/> Operations <ChevronDown size={14}/>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        )
    };

    // --- Page Renderer ---
    const renderPage = () => {
        if (!isAuthReady || isProfileLoading) {
            return <div className="flex items-center justify-center min-h-screen bg-gray-100"><div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500"></div></div>;
        }
        switch (currentPage) {
            case 'profile': return <ProfilePage />;
            case 'sourcing': return <SourcingPage />;
            case 'orderForm': return <OrderFormPage />;
            case 'crm': return <CRMPage />;
            case 'factorySuggestions': return <FactorySuggestionsPage />;
            case 'factoryDetail': return <FactoryDetailPage />;
            case 'factoryTools': return <FactoryToolsPage />;
            case 'settings': return <SettingsPage />;
            case 'tracking': return <OrderTrackingPage />;
            case 'trending': return <TrendingPage />;
            case 'myQuotes': return <MyQuotesPage />;
            case 'quoteRequest': return <QuoteRequestPage />;
            case 'quoteDetail': return <QuoteDetailPage />;
            default: return <LoginPage />;
        }
    };

    // --- Sourcing Page (Main Dashboard) ---
    const SourcingPage: FC = () => {
        const initialFilters = { rating: 0, maxMoq: 10000, tags: [], categories: [], location: '', certifications: [] };
        const [searchTerm, setSearchTerm] = useState('');
        const [filters, setFilters] = useState(initialFilters);
        const [showFilterPanel, setShowFilterPanel] = useState(false);
        const [isFiltering, setIsFiltering] = useState(false);
        const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
        const profileDropdownRef = useRef<HTMLDivElement>(null);

        const garmentCategories = useMemo(() => ['T-shirt', 'Polo Shirt', 'Hoodies', 'Jeans', 'Jackets', 'Shirts', 'Casual Shirts', 'Trousers'], []);
        const allCertifications = useMemo(() => ['Sedex', 'Oeko-Tex Standard 100', 'BCI', 'WRAP', 'ISO 9001'], []);

        const clearFilters = () => {
            setFilters(initialFilters);
        };

        // Close profile dropdown on outside click
        useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
                    setIsProfileDropdownOpen(false);
                }
            };
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }, []);


        const filteredFactories = useMemo(() => {
            return allFactories
                .filter(f => selectedGarmentCategory === 'All' || f.specialties.includes(selectedGarmentCategory))
                .filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.location.toLowerCase().includes(searchTerm.toLowerCase()))
                .filter(f => f.rating >= filters.rating)
                .filter(f => f.minimumOrderQuantity <= filters.maxMoq)
                .filter(f => filters.tags.length === 0 || filters.tags.every(tag => f.tags.includes(tag)))
                .filter(f => filters.categories.length === 0 || filters.categories.some(cat => f.specialties.includes(cat)))
                .filter(f => filters.location === '' || f.location.toLowerCase().includes(filters.location.toLowerCase()))
                .filter(f => filters.certifications.length === 0 || filters.certifications.every(cert => f.certifications.includes(cert)));
        }, [selectedGarmentCategory, searchTerm, filters, allFactories]);

        useEffect(() => {
            setIsFiltering(true);
            const timer = setTimeout(() => setIsFiltering(false), 500);
            return () => clearTimeout(timer);
        }, [filteredFactories]);

        const displayCategories = [
            { name: 'All', icon: <SlidersHorizontal size={28} /> },
            { name: 'T-shirt', imageUrl: 'https://images.meesho.com/images/products/319819104/emgui_512.webp' },
            { name: 'Polo Shirt', imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQOzMIpappu3uVuhjfgNBRsGLNyjc-QDK9oOg&s' },
            { name: 'Shirts', imageUrl: 'https://thehouseofrare.com/cdn/shop/products/IMG_0180_f6c0cc37-6ce6-4d0b-82ac-fd550ecd4ada.jpg?v=1743587518' },
            { name: 'Casual Shirts', imageUrl: 'https://5.imimg.com/data5/SELLER/Default/2023/1/RR/KJ/UE/102058255/shimak-casual-shirts-printed-full-sleeve-500x500.jpeg' },
            { name: 'Trousers', imageUrl: 'https://www.urbanofashion.com/cdn/shop/files/chino-olivegrn.jpg?v=1738593135' },
            { name: 'Jeans', imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQlDNy727l9wMphtlsqFGgkikBgIpFZy5-7CQ&s' },
            { name: 'Hoodies', imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTob-lFFOTnZnxHaLaB7JPF7okEnYqyViiGDg&s' },
            { name: 'Jackets', imageUrl: 'https://thehouseofrare.com/cdn/shop/files/royban-2-mens-jacket-olive9_b797e9f6-b0e3-4e35-ac41-37063bd008fa.webp?v=1740640005' }
        ];

        const filterChips = ["Fast Turnaround", "Sustainable", "Prime"];

        const DashboardCard: FC<{ icon: ReactNode; title: string; value: string | number; colorClass: string }> = ({ icon, title, value, colorClass }) => (
            <div className={`relative p-5 rounded-xl overflow-hidden bg-white shadow-md transition-transform hover:scale-105`}>
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${colorClass}`}></div>
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">{title}</p>
                        <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
                    </div>
                    <div className={`p-2 rounded-full bg-opacity-20 ${colorClass.split(' ')[1].replace('from-', 'bg-')}`}>
                        {icon}
                    </div>
                </div>
            </div>
        );

        const Dashboard: FC = () => {
            const dashboardData = {
                activeOrders: 3,
                unitsInProduction: '17,500',
                totalOrderValue: '$125.5K',
                partnerFactories: allFactories.length,
            };
            return(
                <section className="mb-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <DashboardCard
                            title="Active Orders"
                            value={dashboardData.activeOrders}
                            icon={<Briefcase className="text-purple-600" size={24}/>}
                            colorClass="from-purple-500 to-indigo-500"
                        />
                        <DashboardCard
                            title="Units in Production"
                            value={dashboardData.unitsInProduction}
                            icon={<Truck className="text-blue-600" size={24}/>}
                            colorClass="from-blue-500 to-cyan-500"
                        />
                        <DashboardCard
                            title="Total Order Value"
                            value={dashboardData.totalOrderValue}
                            icon={<DollarSign className="text-green-600" size={24}/>}
                            colorClass="from-green-500 to-emerald-500"
                        />
                        <DashboardCard
                            title="Partner Factories"
                            value={dashboardData.partnerFactories}
                            icon={<Building className="text-orange-600" size={24}/>}
                            colorClass="from-orange-500 to-amber-500"
                        />
                    </div>
                </section>
            );
        };

        const CategoryCarousel: FC = () => {
            const scrollRef = useRef<HTMLDivElement>(null);
            const scroll = (direction: 'left' | 'right') => {
                if (scrollRef.current) {
                    const { current } = scrollRef;
                    const scrollAmount = direction === 'left' ? -current.offsetWidth / 2 : current.offsetWidth / 2;
                    current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
                }
            };
            return (
                <div className="relative">
                    <div className="flex items-center">
                        <button onClick={() => scroll('left')} className="absolute -left-4 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-md top-1/2 -translate-y-1/2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-all">
                            <ChevronLeft className="w-6 h-6 text-gray-700" />
                        </button>
                        <div ref={scrollRef} className="flex items-center space-x-2 sm:space-x-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                            {displayCategories.map(cat => {
                                const isSelected = selectedGarmentCategory === cat.name;
                                return (
                                    <button
                                        key={cat.name}
                                        onClick={() => setSelectedGarmentCategory(cat.name)}
                                        className="flex-shrink-0 flex flex-col items-center justify-start space-y-2 p-1 transition-transform hover:scale-105 group w-24 text-center"
                                    >
                                        <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${isSelected ? 'p-1 bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-transparent'}`}>
                                            <div className={`w-full h-full rounded-full bg-white flex items-center justify-center ${!isSelected ? 'ring-1 ring-gray-200' : ''}`}>
                                                {cat.imageUrl ? (
                                                    <img
                                                        src={cat.imageUrl}
                                                        alt={cat.name}
                                                        className="w-full h-full object-cover rounded-full"
                                                        onError={(e) => { (e.target as HTMLImageElement).onerror = null; (e.target as HTMLImageElement).src=`https://placehold.co/80x80/e9d5ff/4c1d95?text=${cat.name}`; }}
                                                    />
                                                ) : (
                                                    <div className="text-gray-600">
                                                        {cat.icon}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`font-semibold text-xs transition-colors ${isSelected ? 'text-purple-700' : 'text-gray-600'}`}>{cat.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <button onClick={() => scroll('right')} className="absolute -right-4 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-md top-1/2 -translate-y-1/2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-all">
                            <ChevronRight className="w-6 h-6 text-gray-700" />
                        </button>
                    </div>
                </div>
            );
        };

        const SkeletonCard: FC = () => (
            <div className="bg-white rounded-2xl shadow-md overflow-hidden animate-pulse">
                <div className="h-48 w-full bg-gray-300"></div>
                <div className="p-4">
                    <div className="h-5 bg-gray-300 rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-gray-300 rounded w-1/2 mb-4"></div>
                    <div className="h-4 bg-gray-300 rounded w-full"></div>
                </div>
            </div>
        );

        const FilterPanel: FC = () => (
            <>
                <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity ${showFilterPanel ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowFilterPanel(false)}></div>
                <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-xl z-50 transform transition-transform duration-300 ${showFilterPanel ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h3 className="text-xl font-bold">Filters</h3>
                            <button onClick={() => setShowFilterPanel(false)} className="p-2 rounded-full hover:bg-gray-100"><X size={24} /></button>
                        </div>
                        <div className="flex-grow p-6 space-y-6 overflow-y-auto">
                           <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Rating</label>
                                <div className="flex justify-center space-x-2">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <Star key={star} size={32} onClick={() => setFilters(f => ({ ...f, rating: star }))} className={`cursor-pointer transition-colors ${filters.rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label htmlFor="moq" className="block text-sm font-medium text-gray-700">Max. MOQ: {filters.maxMoq.toLocaleString()} units</label>
                                <input type="range" id="moq" min="0" max="10000" step="100" value={filters.maxMoq} onChange={e => setFilters(f => ({ ...f, maxMoq: parseInt(e.target.value) }))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Product Categories</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {garmentCategories.map(cat => (
                                        <button key={cat} onClick={() => {
                                            const newCategories = filters.categories.includes(cat)
                                                ? filters.categories.filter(c => c !== cat)
                                                : [...filters.categories, cat];
                                            setFilters(f => ({ ...f, categories: newCategories }));
                                        }} className={`text-sm p-2 rounded-md transition-colors ${filters.categories.includes(cat) ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}>
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Certifications</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {allCertifications.map(cert => (
                                        <button key={cert} onClick={() => {
                                            const newCerts = filters.certifications.includes(cert)
                                                ? filters.certifications.filter(c => c !== cert)
                                                : [...filters.certifications, cert];
                                            setFilters(f => ({ ...f, certifications: newCerts }));
                                        }} className={`text-sm p-2 rounded-md transition-colors ${filters.certifications.includes(cert) ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}>
                                            {cert}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label htmlFor="location" className="block text-sm font-medium text-gray-700">Location</label>
                                <input type="text" id="location" value={filters.location} onChange={e => setFilters(f => ({ ...f, location: e.target.value }))} placeholder="e.g., Dhaka, Bangladesh" className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" />
                            </div>
                        </div>
                        <div className="p-6 border-t grid grid-cols-2 gap-4">
                            <button onClick={clearFilters} className="w-full flex items-center justify-center gap-2 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all">
                                <Trash2 size={16} /> Clear All
                            </button>
                            <button onClick={() => setShowFilterPanel(false)} className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-all shadow-md">
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );

        const ProfileDropdown: FC = () => (
            <div ref={profileDropdownRef} className="relative">
                <button onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)} className="hidden md:flex w-12 h-12 rounded-full bg-purple-200 border-2 border-white items-center justify-center text-purple-700 font-bold text-xl shadow-md cursor-pointer">
                    {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
                </button>
                {isProfileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20 animate-fade-in">
                        <button onClick={() => { handleSetCurrentPage('profile'); setIsProfileDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                            <UserIcon size={16} className="mr-2" /> My Profile
                        </button>
                        <button onClick={() => { handleSignOut(); setIsProfileDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center">
                            <LogOut size={16} className="mr-2" /> Logout
                        </button>
                    </div>
                )}
            </div>
        );

        return (
            <MainLayout pageKey={pageKey}>
                <header className="mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <button className="flex items-center text-2xl font-bold text-gray-800">
                                Dashboard <ChevronDown className="h-5 w-5 ml-1 text-gray-500" />
                            </button>
                            <p className="text-gray-500 text-sm mt-1">Welcome back, {userProfile?.name ? userProfile.name.split(' ')[0] : 'User'}!</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button className="p-2 rounded-full bg-white shadow-sm md:hidden"><Search size={20} className="text-gray-600" /></button>
                            <button onClick={toggleMenu} className="p-2 rounded-full bg-white shadow-sm md:hidden"><Menu size={20} className="text-gray-600" /></button>
                            <ProfileDropdown />
                        </div>
                    </div>
                    <div className="relative mt-6 flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-grow">
                            <Search className="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" placeholder="Search factories by name or location..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm" />
                        </div>
                        <button onClick={() => setShowFilterPanel(true)} className="flex-shrink-0 px-4 py-3 bg-white border border-gray-200 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-100 font-semibold shadow-sm"><SlidersHorizontal size={16} /> <span className="hidden sm:inline">Filters</span></button>
                    </div>
                </header>
                <Dashboard />
                <section className="mb-6">
                    <CategoryCarousel />
                </section>
                <section className="mb-6">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                        {filterChips.map(chip => {
                            const isActive = filters.tags.includes(chip);
                            return (
                                <button
                                    key={chip}
                                    onClick={() => setFilters(f => ({ ...f, tags: f.tags.includes(chip) ? f.tags.filter(t => t !== chip) : [...f.tags, chip] }))}
                                    className={`flex-shrink-0 px-4 py-2 border rounded-full text-sm font-semibold transition-colors ${isActive ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-gray-300 hover:bg-gray-100'}`}
                                >
                                    {chip}
                                </button>
                            )
                        })}
                    </div>
                </section>
                <section>
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Recommended For You</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {isFiltering ? (
                            Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} />)
                        ) : filteredFactories.length > 0 ? (
                            filteredFactories.map((factory, index) => (
                                <FactoryCard key={factory.id} factory={factory} onSelect={() => handleSelectFactory(factory)} style={{ animationDelay: `${index * 60}ms` }} />
                            ))
                        ) : (
                            <div className="col-span-full text-center py-12 bg-white rounded-2xl shadow-sm">
                                <Package className="mx-auto h-16 w-16 text-gray-400" />
                                <p className="text-gray-600 font-semibold mt-4">No Factories Found</p>
                                <p className="text-gray-500 text-sm">Try adjusting your category or search filters.</p>
                            </div>
                        )}
                    </div>
                </section>
                <FilterPanel />
            </MainLayout>
        );
    };

    const TrendingPage: FC = () => {
        const trendBlogs = [
            { id: 1, title: 'The Rise of Sustainable Denim', category: 'Materials', author: 'Vogue Business', date: 'June 24, 2025', imageUrl: 'https://ninelondon.co.uk/cdn/shop/articles/Guide_on_Sustainable_Jeans-_The_Future_of_Ethical_Fashion.jpg?v=1742809387' },
            { id: 2, title: 'Utility Wear: Function Meets Fashion', category: 'Styles', author: 'Hypebeast', date: 'June 23, 2025', imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT45WPOXDJhJUrtWtQCIhBDEBzdxfZG8wJmig&s' },
            { id: 3, title: 'Tech-Infused Fabrics are the Future', category: 'Innovation', author: 'WGSN', date: 'June 22, 2025', imageUrl: 'https://www.digitaltrends.com/wp-content/uploads/2019/02/190207142242_1_900x600.jpg?fit=720%2C480&p=1' },
        ];
        const fashionShorts = [
            { id: 1, creator: '@fashionista.diaries', views: '1.2M', videoUrl: 'https://youtube.com/shorts/kO-0HbPq1ec?si=k3xoYY4Fgtd2Ed9L', thumbnail: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=300&h=500&auto=format&fit=crop' },
            { id: 2, creator: '@stylebyraul', views: '890K', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', thumbnail: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=300&h=500&auto=format&fit=crop' },
            { id: 3, creator: '@denimqueen', views: '2.5M', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', thumbnail: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRmDXe8m1LiarHW_nFhOakVDDuaRichGrky-Q&s' },
            { id: 4, creator: '@modern.man', views: '750K', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', thumbnail: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=300&h=500&auto=format&fit=crop' },
        ];
        const [fullscreenVideo, setFullscreenVideo] = useState<string | null>(null);

        const FullscreenVideoPlayer: FC<{ src: string; onClose: () => void }> = ({ src, onClose }) => {
            if (!src) return null;
            return (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100]" onClick={onClose}>
                    <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-300 transition z-[101]">
                        <X size={32} />
                    </button>
                    <div className="relative w-auto h-[90vh] aspect-[9/16]" onClick={e => e.stopPropagation()}>
                        <video src={src} autoPlay controls loop className="w-full h-full rounded-lg" />
                    </div>
                </div>
            )
        }

        return (
            <MainLayout pageKey={pageKey}>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">What's Trending</h1>
                <p className="text-gray-500 mb-8">Discover the latest in fashion, materials, and manufacturing.</p>
                {/* Banners */}
                <section className="mb-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="relative rounded-xl overflow-hidden h-64 group cursor-pointer col-span-1 md:col-span-2">
                            <img src="https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=1200&h=400&auto=format&fit=crop" alt="Summer Collection" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"/>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                            <div className="absolute bottom-0 left-0 p-6 text-white">
                                <h2 className="text-3xl font-bold">Summer 2025 Collections</h2>
                                <p className="mt-1">Explore the vibrant colors and lightweight fabrics defining the season.</p>
                                <button className="mt-4 bg-white text-black font-semibold py-2 px-4 rounded-lg hover:bg-opacity-90 transition">Explore Now</button>
                            </div>
                        </div>
                    </div>
                </section>
                <section className="mb-12">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Latest Articles</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {trendBlogs.map(blog => (
                            <div key={blog.id} className="bg-white rounded-xl shadow-md overflow-hidden group cursor-pointer">
                                <div className="overflow-hidden">
                                    <img src={blog.imageUrl} alt={blog.title} className="h-48 w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                </div>
                                <div className="p-6">
                                    <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-1 rounded-full">{blog.category}</span>
                                    <h3 className="font-bold text-lg text-gray-800 mt-3 mb-2">{blog.title}</h3>
                                    <p className="text-sm text-gray-500">By {blog.author} · {blog.date}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
                <section>
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Fashion Shorts</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {fashionShorts.map(short =>(
                            <div key={short.id} className="relative rounded-xl overflow-hidden shadow-lg group cursor-pointer aspect-[9/16]" onClick={() => setFullscreenVideo(short.videoUrl)}>
                                <img src={short.thumbnail} alt={short.creator} className="absolute inset-0 w-full h-full object-cover"/>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-300">
                                    <PlayCircle size={48} className="text-white/80" />
                                </div>
                                <div className="absolute bottom-0 left-0 p-4 text-white">
                                    <p className="font-semibold text-sm">{short.creator}</p>
                                    <p className="text-xs">{short.views} views</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
                {fullscreenVideo && <FullscreenVideoPlayer src={fullscreenVideo} onClose={() => setFullscreenVideo(null)} />}
            </MainLayout>
        )
    }

    const MyQuotesPage: FC = () => {
        const getStatusColor = (status: string) => {
            switch (status) {
                case 'Pending': return 'bg-yellow-100 text-yellow-800';
                case 'Responded': return 'bg-blue-100 text-blue-800';
                case 'Accepted': return 'bg-green-100 text-green-800';
                case 'Declined': return 'bg-red-100 text-red-800';
                default: return 'bg-gray-100 text-gray-800';
            }
        };
        return (
            <MainLayout pageKey={pageKey}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">My Quote Requests</h1>
                        <p className="text-gray-500 mt-1">Track the status of your quote requests.</p>
                    </div>
                    <button onClick={() => handleSetCurrentPage('orderForm')} className="bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-purple-700 transition shadow-md">
                        <Plus size={18} /> Request New Quote
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Factory</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">View</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {quoteRequests.length > 0 ? quoteRequests.map(quote => (
                                    <tr key={quote.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10">
                                                    <img className="h-10 w-10 rounded-full object-cover" src={quote.factory.imageUrl} alt={quote.factory.name} />
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{quote.factory.name}</div>
                                                    <div className="text-sm text-gray-500">{quote.factory.location}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{quote.order.category}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{quote.order.qty}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(quote.submittedAt).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(quote.status)}`}>
                                                {quote.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleSetCurrentPage('quoteDetail', quote)} className="text-purple-600 hover:text-purple-900">View Details</button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="text-center py-10">
                                            <FileQuestion className="mx-auto h-12 w-12 text-gray-400" />
                                            <h3 className="mt-2 text-sm font-medium text-gray-900">No quote requests</h3>
                                            <p className="mt-1 text-sm text-gray-500">Get started by requesting a quote from a factory.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </MainLayout>
        );
    };

    const QuoteRequestPage: FC = () => {
        if (!selectedFactory) {
            handleSetCurrentPage('sourcing');
            return null;
        }
        const handleQuoteSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            const quoteData = {
                factory: {
                    id: selectedFactory.id,
                    name: selectedFactory.name,
                    location: selectedFactory.location,
                    imageUrl: selectedFactory.imageUrl,
                },
                order: orderFormData,
                files: uploadedFiles.map(f => f.name), // Storing file names for reference
            };
            submitQuoteRequest(quoteData);
        };
        return (
            <MainLayout pageKey={pageKey}>
                <div className="max-w-4xl mx-auto">
                    <button onClick={() => handleSetCurrentPage('factoryDetail')} className="text-purple-600 font-semibold mb-4 flex items-center hover:underline">
                        <ChevronLeft className="h-5 w-5 mr-1" />
                        Back to Factory Details
                    </button>
                    <div className="bg-white p-8 rounded-xl shadow-lg">
                        <h2 className="text-3xl font-bold text-gray-800 mb-2">Request a Quote</h2>
                        <p className="text-gray-500 mb-6">Review your order details and submit your request to <span className="font-semibold">{selectedFactory.name}</span>.</p>
                        <form onSubmit={handleQuoteSubmit}>
                            <div className="space-y-6">
                                <div className="p-4 border rounded-lg">
                                    <h3 className="text-lg font-semibold text-gray-700 mb-4">Factory Information</h3>
                                    <div className="flex items-center gap-4">
                                        <img src={selectedFactory.imageUrl} alt={selectedFactory.name} className="w-16 h-16 rounded-lg object-cover" />
                                        <div>
                                            <p className="font-bold text-gray-900">{selectedFactory.name}</p>
                                            <p className="text-sm text-gray-500">{selectedFactory.location}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 border rounded-lg">
                                    <h3 className="text-lg font-semibold text-gray-700 mb-4">Your Order Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <p><strong>Product:</strong> {orderFormData.category}</p>
                                        <p><strong>Quantity:</strong> {orderFormData.qty} units</p>
                                        <p><strong>Fabric:</strong> {orderFormData.fabricQuality}</p>
                                        <p><strong>Weight:</strong> {orderFormData.weightGSM} GSM</p>
                                        <p className="md:col-span-2"><strong>Style:</strong> {orderFormData.styleOption}</p>
                                        <p className="md:col-span-2"><strong>Shipping To:</strong> {orderFormData.shippingDest}</p>
                                    </div>
                                </div>
                                {uploadedFiles.length > 0 && (
                                    <div className="p-4 border rounded-lg">
                                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Attached Documents</h3>
                                        <ul className="space-y-1">
                                            {uploadedFiles.map((file, index) => (
                                                <li key={index} className="text-sm text-gray-600 flex items-center">
                                                    <FileText size={16} className="mr-2 text-gray-400" />
                                                    {file.name}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            <div className="mt-8 text-right">
                                <button type="submit" className="px-8 py-3 text-white rounded-lg font-semibold bg-purple-600 hover:bg-purple-700 transition shadow-md">
                                    Submit Quote Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </MainLayout>
        );
    };

    const QuoteDetailPage: FC = () => {
        if (!selectedQuote) {
            handleSetCurrentPage('myQuotes');
            return null;
        }
        const { factory, order, status, submittedAt } = selectedQuote;
        return (
            <MainLayout pageKey={pageKey}>
                <button onClick={() => handleSetCurrentPage('myQuotes')} className="text-purple-600 font-semibold mb-4 flex items-center hover:underline">
                    <ChevronLeft className="h-5 w-5 mr-1" />
                    Back to My Quotes
                </button>
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-800">Quote Details</h2>
                            <p className="text-gray-500 mt-1">Submitted on {new Date(submittedAt).toLocaleDateString()}</p>
                        </div>
                        <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                            status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                            status === 'Responded' ? 'bg-blue-100 text-blue-800' :
                            status === 'Accepted' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                            {status}
                        </span>
                    </div>
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Factory Info */}
                        <div className="p-4 border rounded-lg">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Factory</h3>
                            <div className="flex items-center gap-4">
                                <img src={factory.imageUrl} alt={factory.name} className="w-20 h-20 rounded-lg object-cover"/>
                                <div>
                                    <p className="font-bold text-lg text-gray-900">{factory.name}</p>
                                    <p className="text-sm text-gray-500">{factory.location}</p>
                                </div>
                            </div>
                        </div>
                        {/* Order Info */}
                        <div className="p-4 border rounded-lg">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Order Summary</h3>
                            <div className="space-y-2 text-sm">
                                <p><strong>Product:</strong> {order.category}</p>
                                <p><strong>Quantity:</strong> {order.qty} units</p>
                                <p><strong>Target Price:</strong> ${order.targetPrice}/unit</p>
                            </div>
                        </div>
                    </div>
                    {/* Full Order Details */}
                    <div className="mt-8 p-4 border rounded-lg">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Full Specifications</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div><p><strong>Fabric:</strong> {order.fabricQuality}</p></div>
                            <div><p><strong>Weight:</strong> {order.weightGSM} GSM</p></div>
                            <div className="md:col-span-2"><p><strong>Style:</strong> {order.styleOption}</p></div>
                            <div className="md:col-span-2"><p><strong>Packaging:</strong> {order.packagingReqs}</p></div>
                            <div className="md:col-span-2"><p><strong>Labeling:</strong> {order.labelingReqs}</p></div>
                            <div className="md:col-span-2"><p><strong>Shipping To:</strong> {order.shippingDest}</p></div>
                        </div>
                    </div>
                    {/* Response Section */}
                    <div className="mt-8">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Factory Response</h3>
                        {status === 'Responded' ? (
                                <div className="bg-blue-50 p-6 rounded-lg">
                                    <p className="font-semibold text-blue-800">Quote Received: $4.25 / unit</p>
                                    <p className="text-sm text-blue-700 mt-2">Lead Time: 30-40 days</p>
                                    <p className="text-sm text-blue-700 mt-1">Notes: We can meet all specifications. Price is based on current material costs.</p>
                                    <div className="mt-4 flex gap-2">
                                        <button className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold">Accept Quote</button>
                                        <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold">Negotiate</button>
                                    </div>
                                </div>
                        ) : (
                            <p className="text-gray-500">Awaiting response from the factory.</p>
                        )}
                    </div>
                </div>
            </MainLayout>
        );
    };

    return (
        <div className="antialiased">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                .font-inter { font-family: 'Inter', sans-serif; }
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                @keyframes card-enter { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                .animate-card-enter { opacity: 0; animation: card-enter 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            <Toast {...toast} />
            {renderPage()}
            {user && currentPage !== 'login' && currentPage !== 'profile' && <AIChatSupport />}
        </div>
    );
};

export default App;
