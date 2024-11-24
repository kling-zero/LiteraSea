'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { X, ChevronDown, Send } from "lucide-react"
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion"
import Image from 'next/image'
import { ethers } from "ethers"
import { getNFTContract } from '@/utils/contract'

interface FloatingBallProps {
    bookTitle: string;
    isDarkMode: boolean;
    currentChapter: string;
    onAskQuestion?: (question: string) => void;
}

interface NFTItem {
    tokenId: string;
    image: string;
    name: string;
}

export function FloatingBall({ 
    bookTitle, 
    isDarkMode, 
    currentChapter,
    onAskQuestion 
}: FloatingBallProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Array<{ type: 'user' | 'bot', content: string }>>([
        { type: 'bot', content: `你好！我是你的阅读助手，很高兴为你解答关于《${bookTitle}》的任何问题。` }
    ])
    const [input, setInput] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)
    const [avatarUrl, setAvatarUrl] = useState<string>(`https://api.dicebear.com/7.x/bottts/svg?seed=${bookTitle}`)
    const [nfts, setNfts] = useState<NFTItem[]>([])
    const [showNFTSelector, setShowNFTSelector] = useState(false)

    // 使用 useMotionValue 来跟踪位置
    const x = useMotionValue(0)
    const y = useMotionValue(0)

    // 添加位置持久化
    useEffect(() => {
        // 从 localStorage 读取保存的位置
        const savedPosition = localStorage.getItem('floatingBallPosition')
        if (savedPosition) {
            const { x: savedX, y: savedY } = JSON.parse(savedPosition)
            x.set(savedX)
            y.set(savedY)
        }
    }, [])

    // 处理拖拽约束
    const dragConstraints = useRef<{ left: number; right: number; top: number; bottom: number }>({
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
    })

    // 更新拖拽约束
    useEffect(() => {
        const updateConstraints = () => {
            if (containerRef.current) {
                const ballWidth = containerRef.current.offsetWidth
                const ballHeight = containerRef.current.offsetHeight
                
                dragConstraints.current = {
                    left: -window.innerWidth + ballWidth + 20,
                    right: -20,
                    top: -window.innerHeight + ballHeight + 20,
                    bottom: -20
                }
            }
        }

        updateConstraints()
        window.addEventListener('resize', updateConstraints)
        return () => window.removeEventListener('resize', updateConstraints)
    }, [])

    // 处理拖拽结束
    const handleDragEnd = () => {
        // 保存位置到 localStorage
        const currentPosition = {
            x: x.get(),
            y: y.get()
        }
        localStorage.setItem('floatingBallPosition', JSON.stringify(currentPosition))
    }

    // 添加吸附效果
    const snapTo = (value: number, threshold: number) => {
        return Math.abs(value) < threshold ? 0 : value
    }

    // 获取用户的所有 NFT
    const fetchUserNFTs = async () => {
        if (!window.ethereum) return;

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const nftContract = getNFTContract(signer);
            const address = await signer.getAddress();

            // 获取用户拥有的 NFT 数量
            const balance = await nftContract.balanceOf(address);
            const nftList: NFTItem[] = [];

            // 获取所有 NFT 的信息
            for (let i = 0; i < Number(balance); i++) {
                const tokenId = await nftContract.tokenOfOwnerByIndex(address, i);
                const tokenURI = await nftContract.tokenURI(tokenId);
                
                try {
                    let metadata;
                    if (tokenURI.startsWith('{')) {
                        metadata = JSON.parse(tokenURI);
                    } else {
                        const response = await fetch(tokenURI);
                        metadata = await response.json();
                    }
                    
                    nftList.push({
                        tokenId: tokenId.toString(),
                        image: metadata.image,
                        name: metadata.name
                    });
                } catch (error) {
                    console.error("获取NFT元数据失败:", error);
                }
            }

            setNfts(nftList);
        } catch (error) {
            console.error("获取NFT列表失败:", error);
        }
    };

    // NFT 选择器组件
    const NFTSelector = () => (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`absolute bottom-20 right-0 w-64 rounded-lg shadow-xl overflow-hidden
                ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}
        >
            <div className={`p-3 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <h3 className="text-sm font-medium">选择 NFT</h3>
            </div>
            <div className="p-2 max-h-60 overflow-y-auto">
                <div className="grid grid-cols-3 gap-2">
                    {nfts.length === 0 ? (
                        <div className="col-span-3 py-4 text-center text-gray-500 text-sm">
                            暂无 NFT
                        </div>
                    ) : (
                        nfts.map((nft) => (
                            <button
                                key={nft.tokenId}
                                onClick={() => {
                                    setAvatarUrl(nft.image);
                                    setShowNFTSelector(false);
                                    localStorage.setItem('selectedNFTAvatar', nft.image);
                                    // 自动打开聊天窗口
                                    setIsOpen(true);
                                }}
                                className="relative group rounded-lg overflow-hidden aspect-square"
                            >
                                <Image
                                    src={nft.image}
                                    alt={nft.name}
                                    width={80}
                                    height={80}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${nft.tokenId}`;
                                    }}
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-white text-xs">使用此 NFT</span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </motion.div>
    );

    // 修改头像点击事件
    const handleAvatarClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        fetchUserNFTs();
        setShowNFTSelector(!showNFTSelector);
        // 如果聊天窗口已打开，则关闭它
        if (isOpen) {
            setIsOpen(false);
        }
    };

    // 在组件加载时检查本地存储的头像
    useEffect(() => {
        const savedAvatar = localStorage.getItem('selectedNFTAvatar');
        if (savedAvatar) {
            setAvatarUrl(savedAvatar);
        }
    }, []);

    // 添加加载状态
    const [isLoading, setIsLoading] = useState(false)
    
    // 处理消息发送
    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMessage = input.trim()
        setInput('')
        
        // 添加用户消息
        setMessages(prev => [...prev, { 
            type: 'user', 
            content: userMessage 
        }])

        setIsLoading(true)

        try {
            // 调用父组件的问答函数
            if (onAskQuestion) {
                // 添加思考中的消息
                setMessages(prev => [...prev, { 
                    type: 'bot', 
                    content: '思考中...' 
                }])

                // 调用问答接口
                const response = await onAskQuestion(userMessage)

                // 更新最后一条消息
                setMessages(prev => {
                    const newMessages = [...prev]
                    newMessages[newMessages.length - 1] = {
                        type: 'bot',
                        content: response || `关于《${bookTitle}》${currentChapter}的问题，我的回答是...`
                    }
                    return newMessages
                })
            }
        } catch (error) {
            // 处理错误
            setMessages(prev => [...prev, { 
                type: 'bot', 
                content: '抱歉，我遇到了一些问题，请稍后再试。' 
            }])
        } finally {
            setIsLoading(false)
        }
    }

    // 自动滚动到底部
    const messagesEndRef = useRef<HTMLDivElement>(null)
    
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    return (
        <motion.div 
            ref={containerRef}
            className="fixed z-50"
            style={{
                bottom: '1.5rem',
                right: '1.5rem',
                x,
                y,
            }}
            drag
            dragMomentum={false}
            dragElastic={0.1}
            dragConstraints={dragConstraints.current}
            onDragEnd={handleDragEnd}
            whileDrag={{ scale: 1.1 }}
            animate={{
                x: snapTo(x.get(), 20),
                y: snapTo(y.get(), 20),
                transition: { type: "spring", stiffness: 400, damping: 25 }
            }}
        >
            <AnimatePresence>
                {showNFTSelector && <NFTSelector />}
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className={`absolute bottom-16 right-0 w-80 rounded-lg shadow-xl overflow-hidden
                            ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        {/* 聊天头部 */}
                        <div className={`p-4 flex justify-between items-center cursor-default
                            ${isDarkMode ? 'bg-gray-700' : 'bg-blue-600'} text-white`}>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-white p-1 flex items-center justify-center">
                                    <div className="w-full h-full rounded-full overflow-hidden">
                                        <Image
                                            src={avatarUrl}
                                            alt="Bot Avatar"
                                            width={28}
                                            height={28}
                                            className="w-full h-full object-cover rounded-full"
                                            onError={() => setAvatarUrl(`https://api.dicebear.com/7.x/bottts/svg?seed=${bookTitle}`)}
                                        />
                                    </div>
                                </div>
                                <span>阅读助手</span>
                            </div>
                            <div className="text-sm text-gray-300">
                                {currentChapter}
                            </div>
                        </div>

                        {/* 消息中的头像也使用 NFT */}
                        <div className={`h-96 overflow-y-auto p-4 space-y-4 cursor-default
                            ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                            {messages.map((message, index) => (
                                <div
                                    key={index}
                                    className={`flex items-end gap-2 ${
                                        message.type === 'user' ? 'justify-end' : 'justify-start'
                                    }`}
                                >
                                    {message.type === 'bot' && (
                                        <div className="w-6 h-6 rounded-full overflow-hidden bg-white p-0.5 flex-shrink-0">
                                            <Image
                                                src={avatarUrl}
                                                alt="Bot Avatar"
                                                width={20}
                                                height={20}
                                                className="w-full h-full object-cover rounded-full"
                                                onError={() => setAvatarUrl(getDefaultAvatar(bookTitle))}
                                            />
                                        </div>
                                    )}
                                    <div className={`max-w-[80%] rounded-lg p-3 ${
                                        message.type === 'user'
                                            ? 'bg-blue-600 text-white'
                                            : isDarkMode
                                                ? 'bg-gray-700 text-gray-100'
                                                : 'bg-gray-100 text-gray-800'
                                    }`}>
                                        {message.content}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* 输入区域添加加载状态 */}
                        <div className={`p-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder={isLoading ? "AI 正在思考..." : "输入你的问题..."}
                                    disabled={isLoading}
                                    className={`flex-1 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
                                        ${isDarkMode 
                                            ? 'bg-gray-700 text-gray-100 placeholder-gray-400' 
                                            : 'bg-gray-50 text-gray-800 placeholder-gray-500'}
                                        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                />
                                <Button 
                                    onClick={handleSend}
                                    disabled={isLoading}
                                    className={`${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : ''}
                                        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isLoading ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Send size={18} />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 悬浮球按钮也使用 NFT 头像 */}
            <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="relative cursor-grab active:cursor-grabbing"
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
                <Button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-12 h-12 rounded-full shadow-lg overflow-hidden p-0
                        ${isOpen 
                            ? 'bg-red-500 hover:bg-red-600' 
                            : isDarkMode
                                ? 'bg-white hover:bg-gray-100' 
                                : 'bg-white hover:bg-gray-50'
                        }
                        transition-all duration-300 ease-in-out
                        hover:shadow-2xl`}
                >
                    {isOpen ? (
                        <X size={24} className="text-white" />
                    ) : (
                        <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
                            <div className="w-full h-full rounded-full overflow-hidden relative group">
                                <Image
                                    src={avatarUrl}
                                    alt="Bot Avatar"
                                    width={32}
                                    height={32}
                                    className="w-full h-full object-cover rounded-full"
                                    onError={() => setAvatarUrl(getDefaultAvatar(bookTitle))}
                                />
                                {/* 添加一个覆盖层用于头像点击 */}
                                <div 
                                    className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAvatarClick(e);
                                    }}
                                >
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <ChevronDown size={16} className="text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </Button>

                {/* 添加聊天按钮提示 */}
                {!isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 
                            px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap text-sm
                            flex items-center gap-2 cursor-pointer"
                        onClick={() => setIsOpen(true)}
                    >
                        <span className="animate-pulse w-2 h-2 rounded-full bg-green-500"></span>
                        点击开始聊天
                    </motion.div>
                )}
            </motion.div>
        </motion.div>
    )
}