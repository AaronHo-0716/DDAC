This `MessageService` is a comprehensive real-time chat system. It handles two types of communication: **Job Chats** (Homeowner $\leftrightarrow$ Handyman) and **Support Chats** (User $\leftrightarrow$ Admins).

Here is a breakdown of what each method does:

### 1. Conversation Management (Creation)

*   **`GetOrCreateJobConversationAsync`**: 
    *   **What it does:** Starts or resumes a chat between a Job Owner and a Handyman.
    *   **Logic:** It first validates that the specific Bid and Job actually exist. It then checks if the user is authorized to be in that chat. If a chat already exists for that specific bid, it just returns it. If not, it creates a new "room" and adds both the Handyman and Homeowner as participants.

*   **`GetOrCreateSupportConversationAsync`**:
    *   **What it does:** Creates a private channel for a user to talk to the Admin team.
    *   **Logic:** It checks if the user already has a support conversation. If not, it creates one. Notice that only the user is added as a participant initially; Admins "join" the conversation the moment they send their first reply.

---

### 2. Message Flow (Sending & Receiving)

*   **`SendMessageAsync`**: 
    *   **The Database Part:** It saves the message to the `messages` table. It stores the `Content` (which is either plain text or an S3 Object Key).
    *   **The Logic Part:** It updates the "Last Message" timestamp of the chat and **increments the unread count** for everyone else in the chat using a high-performance database update (`ExecuteUpdateAsync`).
    *   **The Real-Time Part:** This is the "Real World" feature. It uses **SignalR** (`hubContext`) to "push" the message to the recipient's screen instantly. It also sends the message to a special "Admins" group if it's a support chat, so any online admin sees it immediately.

---

### 3. User Interface Data (Viewing)

*   **`GetUserConversationsAsync`**: 
    *   **What it does:** Fetches the "Inbox" list for a user.
    *   **Logic:** Regular users only see chats they are part of. **Admins** have a special "God Mode" view where they see all `AdminSupport` chats (so they can provide help) plus any specific Job chats they might be part of. It sorts them by the most recent message.

*   **`GetConversationMessagesAsync`**: 
    *   **What it does:** Loads the actual chat history (the bubbles) when you click on a conversation.

*   **`GetTotalUnreadCountAsync`**: 
    *   **What it does:** Calculates the sum of all unread messages across all chats. This is usually used to show a red notification badge (e.g., "3") on the app's navigation bar.

---

### 4. User Experience (State Management)

*   **`MarkAsReadAsync`**: 
    *   **What it does:** When a user opens a chat room, this method resets their `Unread_Count` for that specific room to `0` in the database.

---

### 5. Data Transformation (Mapping)

*   **`MapToConversationDto` (Private Helper)**: 
    *   This is the "Brain" of the response. It gathers the last message, calculates the user's unread count, and fetches participant details.
    *   **Handyman Feature:** It ensures that if a participant is a handyman, their **Average Rating** is included in the DTO so the other person sees how reliable they are.
    *   **Avatar Feature:** It resolves the S3 Object Key into a **Pre-signed URL** so the profile pictures actually load.

*   **`MapMessageToDto` (Private Helper)**:
    *   This handles individual message bubbles.
    *   **Image Support:** Crucially, it checks if `Message_Type` is `"Image"`. If it is, it treats the text in the database as an S3 Key and generates a **temporary secure link** using `GetPresignedUrl`. This allows the recipient to see the image even if your S3 bucket is private.

### Summary of "Real World" Implementation
1.  **Speed**: Uses `ExecuteUpdateAsync` for counts so the database doesn't slow down.
2.  **Instant**: Uses SignalR so users don't have to refresh the page.
3.  **Security**: Generates temporary S3 links so your files are never exposed to the public internet directly.
4.  **Admin Logic**: Implements a broadcast system where all admins receive support requests.