let messageLoadVersion = 0;

async function loadMessages(conversationId) {
  const version = ++messageLoadVersion;

  const { data, error } = await supabaseClient
    .from("messages")
    .select("id, conversation_id, sender_id, body, status, read_at, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) throw error;

  // يمنع عرض رسائل محادثة قديمة بعد الانتقال لمحادثة ثانية
  if (
    version !== messageLoadVersion ||
    conversationId !== activeConversationId
  ) {
    return;
  }

  activeMessages = data || [];
  renderMessages();
}

async function openConversation(id) {
  const conversation = conversations.find(
    (item) => String(item.id) === String(id)
  );

  if (!conversation) return;

  activeConversationId = conversation.id;
  messageLoadVersion++;
  activeMessages = [];
  conversation.unread = 0;

  renderConversationList($("#searchInput").value);
  renderActiveConversation();
  appShell.classList.add("chat-open");

  try {
    await subscribeToActiveConversation();
    await loadMessages(conversation.id);

    if (activeConversationId !== conversation.id) return;

    await markConversationRead(conversation.id);
  } catch (error) {
    console.error("Open conversation error:", error);
    showToast(friendlyError(error), "error");
  }

  if (activeConversationId === conversation.id) {
    messageInput.focus({ preventScroll: true });
  }
}

async function sendMessage(text) {
  const body = String(text || "").trim();
  const conversation = currentConversation();

  if (!body || !conversation || !currentUser || sendBtn.disabled) {
    return;
  }

  const conversationId = conversation.id;
  sendBtn.disabled = true;

  try {
    const { data, error } = await supabaseClient
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: currentUser.id,
        body,
        status: "sent"
      })
      .select(
        "id, conversation_id, sender_id, body, status, read_at, created_at"
      )
      .single();

    if (error) throw error;

    // لا نمسح رسالة جديدة كتبها المستخدم أثناء الإرسال
    if (
      activeConversationId === conversationId &&
      messageInput.value === text
    ) {
      messageInput.value = "";
    }

    if (activeConversationId === conversationId) {
      addMessageIfMissing(data);
    }

    await loadConversations();
  } catch (error) {
    console.error("Send message error:", error);
    showToast(friendlyError(error), "error");
  } finally {
    setComposerEnabled(Boolean(currentConversation()));
  }

  if (currentConversation()) {
    messageInput.focus({ preventScroll: true });
  }
}
