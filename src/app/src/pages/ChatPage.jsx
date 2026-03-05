import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Send, 
  Paperclip, 
  Smile, 
  MoreVertical, 
  Bot,
  User as UserIcon,
  Clock,
  CheckCheck,
  BarChart3
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const initialMessages = [
  {
    id: 1,
    type: 'received',
    sender: 'Databricks Assistant',
    avatar: 'assistant',
    content: 'Hello! I\'m your Databricks AI assistant. I can help you analyze data, create visualizations, and answer questions about your retail analytics.',
    timestamp: '2 min ago',
    status: 'delivered'
  },
  {
    id: 2,
    type: 'sent',
    sender: 'You',
    avatar: 'user',
    content: 'Can you show me the latest sales trends for this quarter?',
    timestamp: '1 min ago',
    status: 'read'
  },
  {
    id: 3,
    type: 'received',
    sender: 'Databricks Assistant',
    avatar: 'assistant',
    content: 'I\'ve analyzed your Q4 sales data. Here are the key insights:\n\n• Revenue increased 23% compared to Q3\n• Top performing category: Electronics (45% growth)\n• Customer acquisition rate: +18%\n• Average order value: $127 (+12%)',
    timestamp: '30s ago',
    status: 'delivered',
    hasAttachment: true,
    attachmentType: 'chart'
  }
]

function MessageBubble({ message, isLast }) {
  const isReceived = message.type === 'received'
  
  return (
    <div className={cn(
      'flex gap-3 mb-4',
      !isReceived && 'flex-row-reverse',
      isLast && 'mb-6'
    )}>
      {/* Avatar */}
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
        isReceived 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-databricks-blue text-white'
      )}>
        {isReceived ? <Bot className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
      </div>

      {/* Message Content */}
      <div className={cn(
        'flex-1 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg',
        !isReceived && 'flex flex-col items-end'
      )}>
        {/* Sender name */}
        <div className={cn(
          'text-xs text-muted-foreground mb-1 px-1',
          !isReceived && 'text-right'
        )}>
          {message.sender}
        </div>

        {/* Message bubble */}
        <div className={cn(
          'rounded-2xl px-4 py-3 break-words',
          isReceived 
            ? 'bg-muted text-foreground rounded-tl-md' 
            : 'bg-primary text-primary-foreground rounded-tr-md'
        )}>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </div>
          
          {/* Attachment indicator */}
          {message.hasAttachment && (
            <div className="mt-3 p-3 bg-background/10 rounded-lg border border-border/20">
              <div className="flex items-center gap-2 text-xs">
                <BarChart3 className="h-4 w-4" />
                <span>Sales_Analysis_Q4.png</span>
                <Badge variant="secondary" className="text-xs">Chart</Badge>
              </div>
            </div>
          )}
        </div>

        {/* Timestamp and status */}
        <div className={cn(
          'flex items-center gap-1 mt-1 px-1',
          !isReceived && 'flex-row-reverse'
        )}>
          <span className="text-xs text-muted-foreground">{message.timestamp}</span>
          {!isReceived && (
            <div className="flex items-center">
              {message.status === 'read' ? (
                <CheckCheck className="h-3 w-3 text-databricks-blue" />
              ) : (
                <Clock className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}



export function ChatPage() {
  const [messages, setMessages] = useState(initialMessages)
  const [newMessage, setNewMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return

    const userMessage = {
      id: Date.now(),
      type: 'sent',
      sender: 'You',
      avatar: 'user',
      content: newMessage,
      timestamp: 'Just now',
      status: 'sent'
    }

    setMessages(prev => [...prev, userMessage])
    setNewMessage('')
    setIsTyping(true)

    // Simulate AI response
    setTimeout(() => {
      const aiResponse = {
        id: Date.now() + 1,
        type: 'received',
        sender: 'Databricks Assistant',
        avatar: 'assistant',
        content: 'I\'m processing your request. Let me analyze the data and get back to you with insights.',
        timestamp: 'Just now',
        status: 'delivered'
      }
      setMessages(prev => [...prev, aiResponse])
      setIsTyping(false)
    }, 2000)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <Card className="flex-1 flex flex-col">
          {/* Chat Header */}
          <CardHeader className="flex-none border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">Databricks Assistant</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-2 h-2 bg-databricks-emerald rounded-full animate-pulse"></div>
                    <span>Active now</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View Profile</DropdownMenuItem>
                    <DropdownMenuItem>Export Chat</DropdownMenuItem>
                    <DropdownMenuItem>Clear History</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>

          {/* Messages Area */}
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-1">
            <div className="max-w-4xl mx-auto">
              {messages.map((message, index) => (
                <MessageBubble 
                  key={message.id} 
                  message={message} 
                  isLast={index === messages.length - 1}
                />
              ))}
              
              {/* Typing indicator */}
              {isTyping && (
                <div className="flex gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-md px-4 py-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={ { animationDelay: '0.1s' } }></div>
              <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={ { animationDelay: '0.2s' } }></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </CardContent>

          {/* Message Input */}
          <div className="flex-none border-t border-border p-4">
            <div className="flex items-end gap-2 max-w-4xl mx-auto">
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                <Paperclip className="h-4 w-4" />
              </Button>
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="w-full min-h-[36px] max-h-32 px-3 py-2 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  rows={1}
                />
              </div>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                <Smile className="h-4 w-4" />
              </Button>
              <Button 
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                size="sm" 
                className="h-9 w-9 p-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}