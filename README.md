# 🎬 NextScene Nova 🚀

**NextScene Nova** is a professional scripting Information Resource Group (IRG) platform designed to streamline show development. From informational blogs to a high-end premium script repository, this platform serves as the ultimate bridge between scriptwriters and show developers worldwide.

---

## 🌟 Key Features

- **Multilingual Support:** A global-ready interface supporting multiple languages (English & Swahili).
- **Premium Fan Vault:** A dedicated, restricted area for premium members to access exclusive scripts and development notes.
- **User Authentication:** Secure local and social (Facebook/Instagram) login systems.
- **Interactive Ratings:** Community-driven feedback system for script development.
- **Informational Blog:** A partially integrated blog for industry news and show development insights.

---

## 🛠️ Tech Stack

**Frontend:**
- HTML5 & CSS3 (Custom Responsive Design)
- JavaScript (ES6+)
- EJS (Embedded JavaScript Templates)

**Backend:**
- Node.js & Express.js
- Passport.js (Authentication)
- i18next (Internationalization)

**Database:**
- MongoDB & Mongoose (ODM)

---

## 📂 Project Structure

This project follows the **MVC (Model-View-Controller)** architecture to ensure scalability and clean code.

```text
NextSceneNova/
├── src/
│   ├── config/             # DB & Passport configurations
│   ├── controllers/        # Business logic & Route handlers
│   ├── middleware/         # Auth & Premium access guards
│   ├── models/             # Mongoose Schemas (User, Script, Post)
│   ├── routes/             # URL endpoint definitions
│   ├── locales/            # Multilingual JSON translations
│   └── views/              # EJS Templates
└── public/                 # Static assets (CSS, Client-JS, Images)