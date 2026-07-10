"use client"

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import {
  Mail,
  Send,
  Loader2,
  Plus,
  X,
  Link2,
  Eye,
  Users,
  Check,
  GripVertical,
  Type,
  Music,
  ArrowUp,
  ArrowDown,
  Trash2,
  ExternalLink,
  Bold,
  AlignCenter,
  AlignLeft,
  Save,
  FolderOpen,
  Headphones,
  TestTube,
} from "lucide-react"
import { collection, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface ShiurOption {
  id: string
  title: string
  rebbe: string
}

interface SavedTemplate {
  id: string
  name: string
  subject: string
  greeting: string
  closing: string
  blocks: EditorBlock[]
  savedAt: string
}

// Block types
type BlockType = "text" | "shiur" | "link" | "button" | "divider" | "card"

interface TextBlock {
  type: "text"
  id: string
  content: string
  centered?: boolean
}

interface ShiurBlock {
  type: "shiur"
  id: string
  shiurId: string
  title: string
  rebbe: string
  url: string
}

interface LinkBlock {
  type: "link"
  id: string
  text: string
  url: string
}

interface ButtonBlock {
  type: "button"
  id: string
  text: string
  url: string
}

interface DividerBlock {
  type: "divider"
  id: string
}

interface CardBlock {
  type: "card"
  id: string
  title: string
  subtitle: string
  buttonText: string
  url: string
}

type EditorBlock = TextBlock | ShiurBlock | LinkBlock | ButtonBlock | DividerBlock | CardBlock

let blockIdCounter = 0
function newBlockId() {
  return `block-${Date.now()}-${blockIdCounter++}`
}

export default function EmailBlastPage() {
  const { toast } = useToast()
  const [sending, setSending] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null)

  // Audience
  const [audience, setAudience] = useState<"subscribers" | "approved_contacts" | "all" | "all_except_contacts">("subscribers")
  const [subscriberCount, setSubscriberCount] = useState(0)
  const [contactCount, setContactCount] = useState(0)
  const [approvedEmailsCount, setApprovedEmailsCount] = useState(0)
  const [approvedExcludeContactsCount, setApprovedExcludeContactsCount] = useState(0)

  // Email content
  const [subject, setSubject] = useState("")
  const [greeting, setGreeting] = useState("Dear Alumni")
  const [closing, setClosing] = useState("Hazlacha,\nThe YTC Alumni Team")

  // Block editor
  const [blocks, setBlocks] = useState<EditorBlock[]>([
    { type: "text", id: newBlockId(), content: "" },
  ])

  // Insert menus
  const [showInsertMenu, setShowInsertMenu] = useState<string | null>(null)
  const [showShiurPicker, setShowShiurPicker] = useState<string | null>(null)
  const [showLinkEditor, setShowLinkEditor] = useState<string | null>(null)
  const [showButtonEditor, setShowButtonEditor] = useState<string | null>(null)
  const [showCardEditor, setShowCardEditor] = useState<string | null>(null)

  // Inline link insertion
  const [showInlineLinkDialog, setShowInlineLinkDialog] = useState<string | null>(null)
  const [showInlineShiurPicker, setShowInlineShiurPicker] = useState<string | null>(null)
  const [inlineLinkText, setInlineLinkText] = useState("")
  const [inlineLinkUrl, setInlineLinkUrl] = useState("")
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const cursorPositionRef = useRef<number>(0)

  // Card editor temp state
  const [cardTitle, setCardTitle] = useState("")
  const [cardSubtitle, setCardSubtitle] = useState("")
  const [cardButtonText, setCardButtonText] = useState("Learn More")
  const [cardUrl, setCardUrl] = useState("")

  // Temp state for link/button
  const [tempLinkText, setTempLinkText] = useState("")
  const [tempLinkUrl, setTempLinkUrl] = useState("")

  // Test email
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [testEmail, setTestEmail] = useState("")

  // Templates
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [showLoadTemplate, setShowLoadTemplate] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)

  // Shiurim
  const [availableShiurim, setAvailableShiurim] = useState<ShiurOption[]>([])
  const [shiurimLoading, setShiurimLoading] = useState(true)
  const [shiurSearch, setShiurSearch] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subscribersSnap, contactsSnap, shiurimSnap, approvedSnap] = await Promise.all([
          getDocs(collection(db, "shiurSubscribers")),
          getDocs(collection(db, "alumniContactSubmissions")),
          getDocs(collection(db, "shiurim")),
          getDocs(collection(db, "approvedEmails")),
        ])

        let subCount = 0
        subscribersSnap.forEach((d) => { if (d.data().email) subCount++ })
        setSubscriberCount(subCount)

        let conCount = 0
        contactsSnap.forEach((d) => { if (d.data().email && d.data().status === "approved") conCount++ })
        setContactCount(conCount)

        setApprovedEmailsCount(approvedSnap.size)

        // Compute approved emails minus those who submitted contact info
        const contactEmails = new Set<string>()
        contactsSnap.forEach((d) => {
          const data = d.data()
          if (data.email) contactEmails.add(data.email.toLowerCase().trim())
        })
        let excludeCount = 0
        approvedSnap.forEach((d) => {
          const data = d.data()
          const email = (data.email || d.id).toLowerCase().trim()
          if (email && !contactEmails.has(email)) excludeCount++
        })
        setApprovedExcludeContactsCount(excludeCount)

        const list: ShiurOption[] = []
        shiurimSnap.forEach((d) => {
          const data = d.data()
          if (data.title) list.push({ id: d.id, title: data.title, rebbe: data.rebbe || "" })
        })
        list.sort((a, b) => a.title.localeCompare(b.title))
        setAvailableShiurim(list)
      } catch (err) {
        console.error("Error fetching data:", err)
      } finally {
        setShiurimLoading(false)
      }
    }
    fetchData()
  }, [])

  // Block operations
  const updateBlock = useCallback((blockId: string, updates: Partial<EditorBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, ...updates } : b)))
  }, [])

  const removeBlock = useCallback((blockId: string) => {
    setBlocks((prev) => {
      const filtered = prev.filter((b) => b.id !== blockId)
      return filtered.length === 0 ? [{ type: "text" as const, id: newBlockId(), content: "" }] : filtered
    })
  }, [])

  const moveBlock = useCallback((blockId: string, direction: "up" | "down") => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId)
      if (idx === -1) return prev
      if (direction === "up" && idx === 0) return prev
      if (direction === "down" && idx === prev.length - 1) return prev
      const next = [...prev]
      const swapIdx = direction === "up" ? idx - 1 : idx + 1
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })
  }, [])

  const insertBlockAfter = useCallback((afterId: string, block: EditorBlock) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === afterId)
      if (idx === -1) return [...prev, block]
      const next = [...prev]
      next.splice(idx + 1, 0, block)
      return next
    })
    setShowInsertMenu(null)
    setShowShiurPicker(null)
    setShowLinkEditor(null)
    setShowButtonEditor(null)
    setShowCardEditor(null)
  }, [])

  const addShiurBlock = (afterId: string, shiur: ShiurOption) => {
    insertBlockAfter(afterId, {
      type: "shiur", id: newBlockId(), shiurId: shiur.id,
      title: shiur.title, rebbe: shiur.rebbe,
      url: `https://alumni.ytchaim.com/shiurim?play=${shiur.id}`,
    })
  }

  const addLinkBlock = (afterId: string) => {
    if (!tempLinkText.trim() || !tempLinkUrl.trim()) return
    insertBlockAfter(afterId, {
      type: "link", id: newBlockId(), text: tempLinkText.trim(),
      url: tempLinkUrl.trim().startsWith("http") ? tempLinkUrl.trim() : `https://${tempLinkUrl.trim()}`,
    })
    setTempLinkText("")
    setTempLinkUrl("")
  }

  const addButtonBlock = (afterId: string) => {
    if (!tempLinkText.trim() || !tempLinkUrl.trim()) return
    insertBlockAfter(afterId, {
      type: "button", id: newBlockId(), text: tempLinkText.trim(),
      url: tempLinkUrl.trim().startsWith("http") ? tempLinkUrl.trim() : `https://${tempLinkUrl.trim()}`,
    })
    setTempLinkText("")
    setTempLinkUrl("")
  }

  const addCardBlock = (afterId: string) => {
    if (!cardTitle.trim() || !cardUrl.trim()) return
    insertBlockAfter(afterId, {
      type: "card", id: newBlockId(), title: cardTitle.trim(),
      subtitle: cardSubtitle.trim(), buttonText: cardButtonText.trim() || "Learn More",
      url: cardUrl.trim().startsWith("http") ? cardUrl.trim() : `https://${cardUrl.trim()}`,
    })
    setCardTitle("")
    setCardSubtitle("")
    setCardButtonText("Learn More")
    setCardUrl("")
  }

  // Inline link helpers
  const saveCursorPosition = (blockId: string) => {
    const el = textareaRefs.current[blockId]
    if (el) cursorPositionRef.current = el.selectionStart
  }

  const insertInlineLink = (blockId: string) => {
    if (!inlineLinkText.trim() || !inlineLinkUrl.trim()) return
    const url = inlineLinkUrl.trim().startsWith("http") ? inlineLinkUrl.trim() : `https://${inlineLinkUrl.trim()}`
    const linkMarkup = `[${inlineLinkText.trim()}](${url})`
    const block = blocks.find((b) => b.id === blockId)
    if (block?.type !== "text") return
    const pos = cursorPositionRef.current
    updateBlock(blockId, { content: block.content.slice(0, pos) + linkMarkup + block.content.slice(pos) })
    setShowInlineLinkDialog(null)
    setInlineLinkText("")
    setInlineLinkUrl("")
  }

  const insertInlineShiurLink = (blockId: string, shiur: ShiurOption) => {
    const url = `https://alumni.ytchaim.com/shiurim?play=${shiur.id}`
    const linkMarkup = `[${shiur.title}](${url})`
    const block = blocks.find((b) => b.id === blockId)
    if (block?.type !== "text") return
    const pos = cursorPositionRef.current
    updateBlock(blockId, { content: block.content.slice(0, pos) + linkMarkup + block.content.slice(pos) })
    setShowInlineShiurPicker(null)
  }

  const renderInlineLinks = (text: string): ReactNode[] => {
    const parts: ReactNode[] = []
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g
    let lastIndex = 0
    let match
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
      parts.push(<span key={match.index} className="text-gold font-semibold underline">{match[1]}</span>)
      lastIndex = regex.lastIndex
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex))
    return parts
  }

  const convertInlineLinksToHtml = (text: string): string => {
    return text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" style="color: #C9A44E; font-weight: 600; text-decoration: underline;">$1</a>'
    )
  }

  const getRecipientCount = () => {
    if (audience === "subscribers") return subscriberCount
    if (audience === "approved_contacts") return contactCount
    if (audience === "all_except_contacts") return approvedExcludeContactsCount
    return approvedEmailsCount
  }

  const getRecipientLabel = () => {
    if (audience === "subscribers") return `${subscriberCount} subscriber${subscriberCount !== 1 ? "s" : ""}`
    if (audience === "approved_contacts") return `${contactCount} approved contact${contactCount !== 1 ? "s" : ""}`
    if (audience === "all_except_contacts") return `${approvedExcludeContactsCount} alumni (excluding those who sent in contact info)`
    return `${approvedEmailsCount} auto-approved alumni email${approvedEmailsCount !== 1 ? "s" : ""}`
  }

  // Convert blocks to HTML
  const blocksToHtml = () => {
    return blocks.map((block) => {
      switch (block.type) {
        case "text": {
          if (!block.content.trim()) return ""
          const align = block.centered ? "center" : "left"
          return block.content.split("\n\n").filter((p) => p.trim())
            .map((p) => `<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.7; text-align: ${align};">${convertInlineLinksToHtml(p.replace(/\n/g, "<br/>"))}</p>`)
            .join("")
        }
        case "shiur":
          return `<div style="background-color: #F8F5EF; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #C9A44E;">
            <a href="${block.url}" style="color: #0C1A35; font-weight: bold; font-size: 16px; text-decoration: none; font-family: Georgia, serif;">${block.title}</a>
            <p style="color: #0C1A35; opacity: 0.6; margin: 6px 0 14px 0; font-size: 14px;">By ${block.rebbe}</p>
            <a href="${block.url}" style="display: inline-block; background-color: #0C1A35; color: #F8F5EF; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-size: 13px; font-weight: bold;">Listen Now</a>
          </div>`
        case "card":
          return `<div style="background-color: #F8F5EF; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #C9A44E;">
            <p style="color: #0C1A35; font-weight: bold; font-size: 16px; margin: 0; font-family: Georgia, serif;">${block.title}</p>
            ${block.subtitle ? `<p style="color: #0C1A35; opacity: 0.6; margin: 6px 0 14px 0; font-size: 14px;">${block.subtitle}</p>` : '<div style="margin-top: 14px;"></div>'}
            <a href="${block.url}" style="display: inline-block; background-color: #0C1A35; color: #F8F5EF; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-size: 13px; font-weight: bold;">${block.buttonText}</a>
          </div>`
        case "link":
          return `<p style="margin: 0 0 16px 0; font-size: 16px;"><a href="${block.url}" style="color: #C9A44E; font-weight: 600; text-decoration: underline;">${block.text}</a></p>`
        case "button":
          return `<div style="margin: 24px 0; text-align: center;">
            <a href="${block.url}" style="display: inline-block; background-color: #C9A44E; color: #0C1A35; padding: 14px 32px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">${block.text}</a>
          </div>`
        case "divider":
          return '<hr style="border: none; border-top: 1px solid #C9A44E; margin: 24px 0; opacity: 0.4;" />'
        default: return ""
      }
    }).join("")
  }

  const buildFullHtml = () => {
    return `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0C1A35; margin: 0; padding: 0; background-color: #f5f5f0;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e0d5;">
          <div style="background-color: #0C1A35; padding: 28px 32px; border-bottom: 3px solid #C9A44E;">
            <h1 style="color: #C9A44E; font-family: Georgia, serif; margin: 0; font-size: 22px;">Yeshiva Toras Chaim</h1>
            <p style="color: #F8F5EF; margin: 4px 0 0 0; font-size: 14px; opacity: 0.8;">Alumni Portal Update</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #0C1A35; font-family: Georgia, serif; font-size: 24px; margin-top: 0; margin-bottom: 20px;">${subject}</h2>
            <p style="font-size: 16px; margin-bottom: 16px;">${greeting || "Dear Alumni"},</p>
            <div style="font-size: 16px; line-height: 1.7;">${blocksToHtml()}</div>
            <p style="font-size: 16px; margin-top: 28px; white-space: pre-line;">${closing || "Hazlacha,\nThe YTC Alumni Team"}</p>
          </div>
          <div style="background-color: #f9f7f3; padding: 20px 32px; border-top: 1px solid #e5e0d5; font-size: 12px; color: #666;">
            <p style="margin: 0 0 4px 0;">Yeshiva Toras Chaim Alumni Portal</p>
            <p style="margin: 0;"><a href="https://alumni.ytchaim.com" style="color: #C9A44E;">alumni.ytchaim.com</a></p>
          </div>
        </div>
      </div>
    </div>`
  }

  const handleSend = async () => {
    setShowConfirm(false)
    setSending(true)
    setSendResult(null)
    try {
      const response = await fetch("/api/send-alumni-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, greeting, bodyHtml: blocksToHtml(), shiurLinks: [], closing, audience }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to send")
      setSendResult({ sent: data.sent, failed: data.failed })
      toast({ title: "Emails Sent", description: `Sent to ${data.sent} recipient${data.sent !== 1 ? "s" : ""}` })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const handleSendTest = async () => {
    if (!testEmail.trim() || !subject.trim()) return
    setSendingTest(true)
    try {
      const response = await fetch("/api/send-alumni-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: `[TEST] ${subject}`, greeting, bodyHtml: blocksToHtml(), shiurLinks: [], closing, audience: "test", testEmail: testEmail.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to send test")
      toast({ title: "Test email sent", description: `Sent to ${testEmail}` })
      setShowTestDialog(false)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSendingTest(false)
    }
  }

  // Template operations
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return
    try {
      await addDoc(collection(db, "emailTemplates"), {
        name: templateName.trim(),
        subject, greeting, closing,
        blocks: JSON.parse(JSON.stringify(blocks)),
        savedAt: new Date().toISOString(),
      })
      toast({ title: "Template saved", description: `"${templateName}" has been saved` })
      setShowSaveTemplate(false)
      setTemplateName("")
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const loadTemplates = async () => {
    setTemplatesLoading(true)
    try {
      const snap = await getDocs(collection(db, "emailTemplates"))
      const list: SavedTemplate[] = []
      snap.forEach((d) => {
        const data = d.data()
        list.push({ id: d.id, name: data.name, subject: data.subject, greeting: data.greeting, closing: data.closing, blocks: data.blocks, savedAt: data.savedAt })
      })
      list.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
      setSavedTemplates(list)
    } catch (err) {
      console.error("Error loading templates:", err)
    } finally {
      setTemplatesLoading(false)
    }
  }

  const loadTemplate = (t: SavedTemplate) => {
    setSubject(t.subject || "")
    setGreeting(t.greeting || "Dear Alumni")
    setClosing(t.closing || "Hazlacha,\nThe YTC Alumni Team")
    // Re-assign block IDs so React keys are fresh
    setBlocks(t.blocks.map((b) => ({ ...b, id: newBlockId() })))
    setShowLoadTemplate(false)
    toast({ title: "Template loaded", description: `"${t.name}" has been loaded` })
  }

  const deleteTemplate = async (id: string) => {
    try {
      await deleteDoc(doc(db, "emailTemplates", id))
      setSavedTemplates((prev) => prev.filter((t) => t.id !== id))
      toast({ title: "Template deleted" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const hasContent = blocks.some((b) =>
    (b.type === "text" && b.content.trim()) || b.type === "shiur" || b.type === "link" || b.type === "button" || b.type === "card"
  )
  const canSend = subject.trim() && hasContent && getRecipientCount() > 0

  const filteredShiurim = availableShiurim.filter((s) =>
    s.title.toLowerCase().includes(shiurSearch.toLowerCase()) || s.rebbe.toLowerCase().includes(shiurSearch.toLowerCase())
  )

  // Insert menu items
  const insertItems = (afterId: string) => [
    { icon: Type, label: "Text", onClick: () => insertBlockAfter(afterId, { type: "text" as const, id: newBlockId(), content: "" }) },
    { icon: Music, label: "Shiur", onClick: () => { setShowInsertMenu(null); setShowShiurPicker(afterId); setShiurSearch("") } },
    { icon: Headphones, label: "Card", onClick: () => { setShowInsertMenu(null); setShowCardEditor(afterId); setCardTitle(""); setCardSubtitle(""); setCardButtonText("Learn More"); setCardUrl("") } },
    { icon: Link2, label: "Link", onClick: () => { setShowInsertMenu(null); setShowLinkEditor(afterId); setTempLinkText(""); setTempLinkUrl("") } },
    { icon: Bold, label: "Button", onClick: () => { setShowInsertMenu(null); setShowButtonEditor(afterId); setTempLinkText(""); setTempLinkUrl("") } },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-navy">Email Blast</h1>
          <p className="text-sm text-navy/60 mt-0.5">Compose and send updates to alumni</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-navy/15 text-navy/70 gap-1.5"
            onClick={() => { setShowLoadTemplate(true); loadTemplates() }}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Load Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-navy/15 text-navy/70 gap-1.5"
            onClick={() => { setShowSaveTemplate(true); setTemplateName("") }}
          >
            <Save className="h-3.5 w-3.5" />
            Save Template
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Composer */}
        <div className="space-y-5">
          {/* Audience */}
          <Card className="border-navy/10 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-navy flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-gold" />
                Recipients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={audience} onValueChange={(v) => setAudience(v as typeof audience)} className="gap-2">
                {[
                  { value: "subscribers", label: "Shiur Subscribers", count: subscriberCount, desc: "Users who signed up for shiur reminders" },
                  { value: "approved_contacts", label: "Approved Alumni Contacts", count: contactCount, desc: "Alumni with approved contact submissions" },
                  { value: "all_except_contacts", label: "All Except Contacts", count: approvedExcludeContactsCount, desc: "Auto-approved alumni who haven't sent in contact info" },
  { value: "all", label: "All Alumni", count: approvedEmailsCount, desc: "All auto-approved alumni emails" },
                ].map((opt) => (
                  <div key={opt.value} className="flex items-center gap-3 p-3 rounded-lg border border-navy/8 hover:bg-navy/[0.02] transition-colors">
                    <RadioGroupItem value={opt.value} id={opt.value} />
                    <Label htmlFor={opt.value} className="flex-1 cursor-pointer">
                      <span className="font-medium text-navy text-sm">{opt.label}</span>
                      {opt.count !== null && <span className="text-xs text-navy/40 ml-1.5">({opt.count})</span>}
                      <p className="text-[11px] text-navy/40 mt-0.5">{opt.desc}</p>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Subject & Greeting */}
          <Card className="border-navy/10 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-navy flex items-center gap-2 text-sm font-semibold">
                <Mail className="h-4 w-4 text-gold" />
                Header
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-navy/60">Subject Line *</Label>
                <Input placeholder="e.g., New Shiurim Available This Week" value={subject} onChange={(e) => setSubject(e.target.value)} className="border-navy/10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-navy/60">Greeting</Label>
                <Input placeholder="Dear Alumni" value={greeting} onChange={(e) => setGreeting(e.target.value)} className="border-navy/10" />
              </div>
            </CardContent>
          </Card>

          {/* Block Editor */}
          <Card className="border-navy/10 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-navy flex items-center gap-2 text-sm font-semibold">
                <Type className="h-4 w-4 text-gold" />
                Email Body
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {blocks.map((block, idx) => (
                <div key={block.id} className="group">
                  <div className="flex gap-2 items-start">
                    {/* Reorder controls */}
                    <div className="flex flex-col items-center gap-0.5 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => moveBlock(block.id, "up")} disabled={idx === 0} className="p-0.5 rounded hover:bg-navy/5 disabled:opacity-20 text-navy/40">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <GripVertical className="h-3.5 w-3.5 text-navy/15" />
                      <button onClick={() => moveBlock(block.id, "down")} disabled={idx === blocks.length - 1} className="p-0.5 rounded hover:bg-navy/5 disabled:opacity-20 text-navy/40">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Block content */}
                    <div className="flex-1 min-w-0">
                      {block.type === "text" && (
                        <div className="space-y-1.5">
                          <Textarea
                            ref={(el) => { textareaRefs.current[block.id] = el }}
                            placeholder="Write your text here..."
                            value={block.content}
                            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                            onSelect={() => saveCursorPosition(block.id)}
                            onClick={() => saveCursorPosition(block.id)}
                            onKeyUp={() => saveCursorPosition(block.id)}
                            className={`resize-y min-h-[70px] border-navy/10 focus:border-gold/50 ${block.centered ? "text-center" : ""}`}
                            rows={3}
                          />
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateBlock(block.id, { centered: !block.centered })}
                              className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded border transition-colors ${block.centered ? "border-gold/40 bg-gold/10 text-gold" : "border-navy/10 text-navy/40 hover:text-gold hover:border-gold/30"}`}
                            >
                              {block.centered ? <AlignCenter className="h-3 w-3" /> : <AlignLeft className="h-3 w-3" />}
                              {block.centered ? "Centered" : "Left"}
                            </button>
                            <span className="w-px h-4 bg-navy/10 mx-0.5" />
                            <button
                              type="button"
                              onClick={() => { saveCursorPosition(block.id); setShowInlineLinkDialog(block.id); setInlineLinkText(""); setInlineLinkUrl("") }}
                              className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-navy/10 text-navy/40 hover:text-gold hover:border-gold/30 transition-colors"
                            >
                              <Link2 className="h-3 w-3" />
                              Link
                            </button>
                            <button
                              type="button"
                              onClick={() => { saveCursorPosition(block.id); setShowInlineShiurPicker(block.id); setShiurSearch("") }}
                              className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-navy/10 text-navy/40 hover:text-gold hover:border-gold/30 transition-colors"
                            >
                              <Music className="h-3 w-3" />
                              Shiur Link
                            </button>
                          </div>
                        </div>
                      )}

                      {block.type === "shiur" && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8F5EF] border-l-4 border-l-gold">
                          <div className="h-10 w-10 rounded-lg bg-navy/10 flex items-center justify-center flex-shrink-0">
                            <Music className="h-5 w-5 text-navy/60" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-serif font-semibold text-navy truncate">{block.title}</p>
                            <p className="text-xs text-navy/50">By {block.rebbe}</p>
                          </div>
                          <span className="text-[10px] bg-navy text-cream px-2.5 py-1 rounded font-bold flex-shrink-0">Listen Now</span>
                        </div>
                      )}

                      {block.type === "card" && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8F5EF] border-l-4 border-l-gold">
                          <div className="h-10 w-10 rounded-lg bg-navy/10 flex items-center justify-center flex-shrink-0">
                            <Headphones className="h-5 w-5 text-navy/60" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-serif font-semibold text-navy truncate">{block.title}</p>
                            {block.subtitle && <p className="text-xs text-navy/50">{block.subtitle}</p>}
                          </div>
                          <span className="text-[10px] bg-navy text-cream px-2.5 py-1 rounded font-bold flex-shrink-0">{block.buttonText}</span>
                        </div>
                      )}

                      {block.type === "link" && (
                        <div className="flex items-center gap-3 p-3 rounded-lg border border-gold/20 bg-gold/5">
                          <ExternalLink className="h-4 w-4 text-gold flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-navy">{block.text}</p>
                            <p className="text-xs text-navy/35 truncate">{block.url}</p>
                          </div>
                        </div>
                      )}

                      {block.type === "button" && (
                        <div className="p-3 rounded-lg border border-gold/20 bg-gold/5 text-center">
                          <span className="inline-block bg-gold text-navy text-sm font-bold px-6 py-2 rounded">{block.text}</span>
                          <p className="text-xs text-navy/35 mt-1 truncate">{block.url}</p>
                        </div>
                      )}

                      {block.type === "divider" && (
                        <div className="py-3"><hr className="border-gold/30" /></div>
                      )}
                    </div>

                    {/* Delete */}
                    {(blocks.length > 1 || block.type !== "text") && (
                      <button onClick={() => removeBlock(block.id)} className="p-1.5 rounded hover:bg-red-50 text-navy/15 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 mt-2">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Insert between blocks */}
                  <div className="relative flex items-center justify-center py-1.5 group/insert">
                    <div className="absolute inset-x-8 border-t border-dashed border-navy/8 group-hover/insert:border-gold/30 transition-colors" />
                    <div className="relative">
                      {showInsertMenu === block.id ? (
                        <div className="flex items-center gap-0.5 bg-white border border-gold/20 rounded-lg shadow-lg p-1 z-10">
                          {insertItems(block.id).map((item) => (
                            <button key={item.label} onClick={item.onClick} className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md hover:bg-navy/5 text-navy/60">
                              <item.icon className="h-3.5 w-3.5" /> {item.label}
                            </button>
                          ))}
                          <button onClick={() => insertBlockAfter(block.id, { type: "divider", id: newBlockId() })} className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md hover:bg-navy/5 text-navy/60">
                            <span className="text-[10px] font-bold leading-none">---</span> Divider
                          </button>
                          <button onClick={() => setShowInsertMenu(null)} className="p-1 rounded-md hover:bg-navy/5 text-navy/30">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setShowInsertMenu(block.id)} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-navy/25 hover:text-gold hover:bg-gold/5 transition-all border border-navy/8 hover:border-gold/20">
                          <Plus className="h-3 w-3" /> Insert
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Add block toolbar */}
              <div className="pt-3 border-t border-dashed border-navy/8 mt-2">
                <p className="text-[10px] text-navy/35 mb-2 font-medium uppercase tracking-wider">Add block</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { icon: Type, label: "Text", action: () => { const id = blocks[blocks.length - 1].id; insertBlockAfter(id, { type: "text" as const, id: newBlockId(), content: "" }) } },
                    { icon: Music, label: "Shiur", action: () => { setShowShiurPicker(blocks[blocks.length - 1].id); setShiurSearch("") } },
                    { icon: Headphones, label: "Card", action: () => { setShowCardEditor(blocks[blocks.length - 1].id); setCardTitle(""); setCardSubtitle(""); setCardButtonText("Learn More"); setCardUrl("") } },
                    { icon: Link2, label: "Link", action: () => { setShowLinkEditor(blocks[blocks.length - 1].id); setTempLinkText(""); setTempLinkUrl("") } },
                    { icon: Bold, label: "Button", action: () => { setShowButtonEditor(blocks[blocks.length - 1].id); setTempLinkText(""); setTempLinkUrl("") } },
                    { icon: () => <span className="text-[10px] font-bold leading-none">---</span>, label: "Divider", action: () => insertBlockAfter(blocks[blocks.length - 1].id, { type: "divider", id: newBlockId() }) },
                  ].map((item) => (
                    <Button key={item.label} type="button" variant="outline" size="sm" onClick={item.action} className="border-navy/10 text-navy/60 hover:bg-navy/5 gap-1 h-7 text-xs px-2.5">
                      <item.icon className="h-3 w-3" /> {item.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Closing */}
          <Card className="border-navy/10 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-navy text-sm font-semibold">Closing</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea rows={2} value={closing} onChange={(e) => setClosing(e.target.value)} className="resize-none border-navy/10" />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPreview(true)} disabled={!subject.trim()} className="border-navy/15 text-navy gap-1.5">
              <Eye className="h-4 w-4" /> Preview
            </Button>
            <Button variant="outline" onClick={() => { setShowTestDialog(true); setTestEmail("") }} disabled={!subject.trim() || !hasContent} className="border-navy/15 text-navy gap-1.5">
              <TestTube className="h-4 w-4" /> Send Test
            </Button>
            <Button onClick={() => setShowConfirm(true)} disabled={!canSend || sending} className="flex-1 bg-navy text-cream hover:bg-navy/90">
              {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : <><Send className="mr-2 h-4 w-4" />Send to {getRecipientLabel()}</>}
            </Button>
          </div>

          {sendResult && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><Check className="h-5 w-5 text-green-600" /></div>
                  <div>
                    <p className="font-medium text-green-900">Email blast sent</p>
                    <p className="text-sm text-green-700">{sendResult.sent} delivered{sendResult.failed > 0 ? `, ${sendResult.failed} failed` : ""}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Live Preview Sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <p className="text-[10px] uppercase tracking-wider text-navy/35 font-medium mb-2">Live Preview</p>
            <div className="bg-[#f5f5f0] rounded-lg p-3 shadow-inner overflow-hidden max-h-[80vh] overflow-y-auto">
              <div className="bg-white rounded-lg overflow-hidden border border-[#e5e0d5] text-left" style={{ fontSize: "11px" }}>
                <div className="bg-navy px-4 py-3" style={{ borderBottom: "2px solid #C9A44E" }}>
                  <p className="font-serif text-gold font-bold text-xs">Yeshiva Toras Chaim</p>
                  <p className="text-cream/60 text-[9px] mt-0.5">Alumni Portal Update</p>
                </div>
                <div className="p-3 space-y-1.5">
                  <h3 className="font-serif text-navy font-bold text-xs leading-snug">{subject || "Subject Line"}</h3>
                  <p className="text-navy text-[10px]">{greeting || "Dear Alumni"},</p>
                  {blocks.map((block) => {
                    if (block.type === "text" && !block.content.trim()) return null
                    return (
                      <div key={block.id}>
                        {block.type === "text" && (
                          <div className={`text-navy/80 text-[10px] whitespace-pre-wrap leading-relaxed ${block.centered ? "text-center" : ""}`}>
                            {renderInlineLinks(block.content)}
                          </div>
                        )}
                        {block.type === "shiur" && (
                          <div className="bg-[#F8F5EF] rounded p-2 my-1" style={{ borderLeft: "2px solid #C9A44E" }}>
                            <p className="font-bold text-navy text-[10px] font-serif">{block.title}</p>
                            <p className="text-navy/50 text-[8px]">By {block.rebbe}</p>
                            <span className="inline-block mt-1 bg-navy text-cream text-[8px] px-1.5 py-0.5 rounded font-bold">Listen Now</span>
                          </div>
                        )}
                        {block.type === "card" && (
                          <div className="bg-[#F8F5EF] rounded p-2 my-1" style={{ borderLeft: "2px solid #C9A44E" }}>
                            <p className="font-bold text-navy text-[10px] font-serif">{block.title}</p>
                            {block.subtitle && <p className="text-navy/50 text-[8px]">{block.subtitle}</p>}
                            <span className="inline-block mt-1 bg-navy text-cream text-[8px] px-1.5 py-0.5 rounded font-bold">{block.buttonText}</span>
                          </div>
                        )}
                        {block.type === "link" && <p className="text-[10px]"><span className="text-gold font-semibold underline">{block.text}</span></p>}
                        {block.type === "button" && (
                          <div className="text-center py-1"><span className="inline-block bg-gold text-navy text-[9px] px-3 py-0.5 rounded font-bold">{block.text}</span></div>
                        )}
                        {block.type === "divider" && <hr className="border-gold/30 my-1.5" />}
                      </div>
                    )
                  })}
                  <p className="text-navy text-[10px] whitespace-pre-line pt-1">{closing || "Hazlacha,\nThe YTC Alumni Team"}</p>
                </div>
                <div className="bg-[#f9f7f3] p-2 border-t border-[#e5e0d5]">
                  <p className="text-[8px] text-navy/35">Yeshiva Toras Chaim Alumni Portal</p>
                  <p className="text-[8px] text-gold">alumni.ytchaim.com</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== DIALOGS ===== */}

      {/* Shiur Picker */}
      <Dialog open={!!showShiurPicker} onOpenChange={() => setShowShiurPicker(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-navy">Insert Shiur</DialogTitle>
            <DialogDescription>Select a shiur to embed as a card</DialogDescription>
          </DialogHeader>
          <Input placeholder="Search shiurim..." value={shiurSearch} onChange={(e) => setShiurSearch(e.target.value)} />
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {shiurimLoading ? (
              <div className="text-center py-6 text-navy/40"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /><p className="text-sm">Loading...</p></div>
            ) : filteredShiurim.length === 0 ? (
              <p className="text-sm text-navy/40 text-center py-6">No shiurim found</p>
            ) : filteredShiurim.map((s) => (
              <button key={s.id} onClick={() => { if (showShiurPicker) addShiurBlock(showShiurPicker, s) }} className="w-full text-left p-3 rounded-lg hover:bg-navy/5 transition-colors flex items-center gap-3">
                <div className="h-8 w-8 rounded bg-navy/10 flex items-center justify-center flex-shrink-0"><Music className="h-4 w-4 text-navy/50" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{s.title}</p>
                  <p className="text-xs text-navy/50">{s.rebbe}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Card Editor */}
      <Dialog open={!!showCardEditor} onOpenChange={() => setShowCardEditor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-navy">Insert Card</DialogTitle>
            <DialogDescription>Custom card styled like a shiur embed</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Title *</Label>
              <Input placeholder="e.g., Weekly Parsha Shiur" value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subtitle (optional)</Label>
              <Input placeholder="e.g., By Rabbi Cohen" value={cardSubtitle} onChange={(e) => setCardSubtitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Button Text</Label>
              <Input placeholder="Learn More" value={cardButtonText} onChange={(e) => setCardButtonText(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">URL *</Label>
              <Input placeholder="https://..." value={cardUrl} onChange={(e) => setCardUrl(e.target.value)} />
            </div>
            {/* Preview */}
            {cardTitle && (
              <div className="bg-[#F8F5EF] rounded-lg p-3 border-l-4 border-l-gold mt-2">
                <p className="font-serif font-bold text-navy text-sm">{cardTitle}</p>
                {cardSubtitle && <p className="text-xs text-navy/50 mt-0.5">{cardSubtitle}</p>}
                <span className="inline-block mt-2 bg-navy text-cream text-[11px] px-3 py-1 rounded font-bold">{cardButtonText || "Learn More"}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCardEditor(null)}>Cancel</Button>
            <Button onClick={() => { if (showCardEditor) addCardBlock(showCardEditor) }} disabled={!cardTitle.trim() || !cardUrl.trim()} className="bg-navy text-cream hover:bg-navy/90">Insert Card</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Editor */}
      <Dialog open={!!showLinkEditor} onOpenChange={() => setShowLinkEditor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-navy">Insert Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Link Text</Label><Input placeholder="Click here to listen" value={tempLinkText} onChange={(e) => setTempLinkText(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">URL</Label><Input placeholder="https://..." value={tempLinkUrl} onChange={(e) => setTempLinkUrl(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkEditor(null)}>Cancel</Button>
            <Button onClick={() => { if (showLinkEditor) addLinkBlock(showLinkEditor) }} disabled={!tempLinkText.trim() || !tempLinkUrl.trim()} className="bg-navy text-cream hover:bg-navy/90">Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Button Editor */}
      <Dialog open={!!showButtonEditor} onOpenChange={() => setShowButtonEditor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-navy">Insert Button</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Button Text</Label><Input placeholder="Visit the Portal" value={tempLinkText} onChange={(e) => setTempLinkText(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">URL</Label><Input placeholder="https://..." value={tempLinkUrl} onChange={(e) => setTempLinkUrl(e.target.value)} /></div>
            {tempLinkText && <div className="text-center pt-2"><span className="inline-block bg-gold text-navy text-sm font-bold px-6 py-2 rounded">{tempLinkText}</span></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowButtonEditor(null)}>Cancel</Button>
            <Button onClick={() => { if (showButtonEditor) addButtonBlock(showButtonEditor) }} disabled={!tempLinkText.trim() || !tempLinkUrl.trim()} className="bg-navy text-cream hover:bg-navy/90">Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Preview */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-navy">Email Preview</DialogTitle>
            <DialogDescription>How the email will look to recipients</DialogDescription>
          </DialogHeader>
          <div className="bg-[#f5f5f0] rounded-lg p-6">
            <div className="bg-white rounded-lg overflow-hidden border border-[#e5e0d5] max-w-[600px] mx-auto">
              <div className="bg-navy py-6 px-8" style={{ borderBottom: "3px solid #C9A44E" }}>
                <h1 className="text-gold font-serif text-xl font-bold">Yeshiva Toras Chaim</h1>
                <p className="text-cream/70 text-sm mt-1">Alumni Portal Update</p>
              </div>
              <div className="p-8 space-y-4">
                <h2 className="font-serif text-navy text-2xl font-bold">{subject || "Subject"}</h2>
                <p className="text-navy">{greeting || "Dear Alumni"},</p>
                {blocks.map((block) => {
                  if (block.type === "text" && !block.content.trim()) return null
                  return (
                    <div key={block.id}>
                      {block.type === "text" && (
                        <div className={`text-navy leading-relaxed whitespace-pre-wrap ${block.centered ? "text-center" : ""}`}>
                          {renderInlineLinks(block.content)}
                        </div>
                      )}
                      {block.type === "shiur" && (
                        <div className="bg-[#F8F5EF] rounded-md p-5 my-3" style={{ borderLeft: "4px solid #C9A44E" }}>
                          <p className="font-bold text-navy font-serif text-lg">{block.title}</p>
                          <p className="text-sm text-navy/60 mt-1">By {block.rebbe}</p>
                          <span className="inline-block mt-3 bg-navy text-cream text-sm px-5 py-2 rounded font-bold">Listen Now</span>
                        </div>
                      )}
                      {block.type === "card" && (
                        <div className="bg-[#F8F5EF] rounded-md p-5 my-3" style={{ borderLeft: "4px solid #C9A44E" }}>
                          <p className="font-bold text-navy font-serif text-lg">{block.title}</p>
                          {block.subtitle && <p className="text-sm text-navy/60 mt-1">{block.subtitle}</p>}
                          <span className="inline-block mt-3 bg-navy text-cream text-sm px-5 py-2 rounded font-bold">{block.buttonText}</span>
                        </div>
                      )}
                      {block.type === "link" && <p className="text-base"><span className="text-gold font-semibold underline">{block.text}</span></p>}
                      {block.type === "button" && (
                        <div className="text-center py-4"><span className="inline-block bg-gold text-navy px-8 py-3 rounded font-bold">{block.text}</span></div>
                      )}
                      {block.type === "divider" && <hr className="border-gold/30 my-4" />}
                    </div>
                  )
                })}
                <p className="text-navy whitespace-pre-line pt-2">{closing}</p>
              </div>
              <div className="bg-[#f9f7f3] px-8 py-5 border-t border-[#e5e0d5] text-sm text-navy/50">
                <p>Yeshiva Toras Chaim Alumni Portal</p>
                <p className="text-gold">alumni.ytchaim.com</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline Link Dialog */}
      <Dialog open={!!showInlineLinkDialog} onOpenChange={() => setShowInlineLinkDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-navy">Insert Inline Link</DialogTitle>
            <DialogDescription>This link appears within your text</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Link Text</Label><Input placeholder="click here to listen" value={inlineLinkText} onChange={(e) => setInlineLinkText(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">URL</Label><Input placeholder="https://..." value={inlineLinkUrl} onChange={(e) => setInlineLinkUrl(e.target.value)} /></div>
            {inlineLinkText && inlineLinkUrl && (
              <div className="bg-navy/5 rounded-lg p-3 text-sm text-navy/80">
                {'...text '}<span className="text-gold font-semibold underline">{inlineLinkText}</span>{' more text...'}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInlineLinkDialog(null)}>Cancel</Button>
            <Button onClick={() => { if (showInlineLinkDialog) insertInlineLink(showInlineLinkDialog) }} disabled={!inlineLinkText.trim() || !inlineLinkUrl.trim()} className="bg-navy text-cream hover:bg-navy/90">Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline Shiur Picker */}
      <Dialog open={!!showInlineShiurPicker} onOpenChange={() => setShowInlineShiurPicker(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-navy">Insert Shiur Link in Text</DialogTitle>
            <DialogDescription>The shiur title becomes a clickable link in your paragraph</DialogDescription>
          </DialogHeader>
          <Input placeholder="Search shiurim..." value={shiurSearch} onChange={(e) => setShiurSearch(e.target.value)} />
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {shiurimLoading ? (
              <div className="text-center py-6 text-navy/40"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /><p className="text-sm">Loading...</p></div>
            ) : filteredShiurim.length === 0 ? (
              <p className="text-sm text-navy/40 text-center py-6">No shiurim found</p>
            ) : filteredShiurim.map((s) => (
              <button key={s.id} onClick={() => { if (showInlineShiurPicker) insertInlineShiurLink(showInlineShiurPicker, s) }} className="w-full text-left p-3 rounded-lg hover:bg-navy/5 transition-colors flex items-center gap-3">
                <div className="h-8 w-8 rounded bg-navy/10 flex items-center justify-center flex-shrink-0"><Music className="h-4 w-4 text-navy/50" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{s.title}</p>
                  <p className="text-xs text-navy/50">{s.rebbe}</p>
                </div>
                <Link2 className="h-4 w-4 text-gold/40 flex-shrink-0" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-navy">Send Test Email</DialogTitle>
            <DialogDescription>Send a test to one email address to preview how it looks in an inbox</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Email Address</Label>
            <Input type="email" placeholder="your@email.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>Cancel</Button>
            <Button onClick={handleSendTest} disabled={!testEmail.trim() || sendingTest} className="bg-navy text-cream hover:bg-navy/90">
              {sendingTest ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : <><TestTube className="mr-2 h-4 w-4" />Send Test</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-navy">Save Template</DialogTitle>
            <DialogDescription>Save this email as a reusable template</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Template Name</Label>
            <Input placeholder="e.g., Weekly Shiur Update" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={!templateName.trim()} className="bg-navy text-cream hover:bg-navy/90">
              <Save className="mr-2 h-4 w-4" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Template Dialog */}
      <Dialog open={showLoadTemplate} onOpenChange={setShowLoadTemplate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-navy">Load Template</DialogTitle>
            <DialogDescription>Load a saved email template</DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-1.5">
            {templatesLoading ? (
              <div className="text-center py-8 text-navy/40"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /><p className="text-sm">Loading templates...</p></div>
            ) : savedTemplates.length === 0 ? (
              <div className="text-center py-8 text-navy/40"><Save className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No saved templates</p></div>
            ) : savedTemplates.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-navy/8 hover:bg-navy/[0.02] transition-colors">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => loadTemplate(t)}>
                  <p className="text-sm font-medium text-navy">{t.name}</p>
                  <p className="text-xs text-navy/40 truncate">{t.subject || "No subject"}</p>
                  <p className="text-[10px] text-navy/30 mt-0.5">
                    {new Date(t.savedAt).toLocaleDateString()} - {t.blocks.length} block{t.blocks.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button onClick={() => deleteTemplate(t.id)} className="p-1.5 rounded hover:bg-red-50 text-navy/20 hover:text-red-500 transition-colors flex-shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Send */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-navy">Confirm Email Blast</DialogTitle>
            <DialogDescription>You are about to send this email to <strong>{getRecipientLabel()}</strong>. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="bg-navy/5 rounded-lg p-4 space-y-1.5 text-sm">
            <p><span className="font-medium text-navy">Subject:</span> {subject}</p>
            <p><span className="font-medium text-navy">Audience:</span> {getRecipientLabel()}</p>
            <p><span className="font-medium text-navy">Blocks:</span>{" "}
              {blocks.filter((b) => b.type === "text" && b.content.trim()).length} text, {blocks.filter((b) => b.type === "shiur").length} shiurim, {blocks.filter((b) => b.type === "card").length} cards, {blocks.filter((b) => b.type === "link").length} links, {blocks.filter((b) => b.type === "button").length} buttons
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending} className="bg-navy text-cream hover:bg-navy/90">
              {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : <><Send className="mr-2 h-4 w-4" />Send Emails</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
