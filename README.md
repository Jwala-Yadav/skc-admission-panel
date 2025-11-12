# SKC Admission Panel

**KG to PG Enquiry Portal for Vasai (East)**

A modern, responsive web application for managing student enquiries across multiple educational levels at SKC Group of Institutions.

---

## 📋 Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [Form Types](#form-types)
- [Technology Stack](#technology-stack)
- [Security](#security)
- [Browser Support](#browser-support)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## ✨ Features

### Student Forms
- **School Admission** - For KG to 10th standard students
- **Junior College (FYJC & SYJC)** - 11th and 12th standard enquiries
- **Degree College** - First, Second, and Third Year admissions

### Form Capabilities
- ✅ Student personal information collection
- ✅ Academic details capture (marks, CGPI, year of passing)
- ✅ University selection dropdown
- ✅ Result status tracking (Pass/Failed)
- ✅ Real-time form validation
- ✅ Year field validation (1947-2030, 4-digit only)
- ✅ Declaration acceptance
- ✅ Success page with enquiry token

### Administrative Features
- 📊 Admin login system
- 📋 Enquiry data management
- 🔍 Search and filter functionality
- 📥 Download enquiry details (PDF format)
- 📈 View all submitted enquiries

### User Experience
- 📱 Fully responsive design (Mobile, Tablet, Desktop)
- 🎨 Modern Tailwind CSS styling
- ⚡ Fast loading and smooth navigation
- 🔒 Code inspection disabled for security
- 🖨️ Print-friendly success pages

---

## 📁 Project Structure

```
SKC_Admissionpannel/
├── index.html              # Main HTML file
├── script.js               # Core JavaScript logic (module)
├── style.css               # Custom CSS styles
├── assets/
│   └── SKC Logo.png        # Institution logo
├── README.md               # This file
└── .gitignore              # Git ignore rules
```

---

## 🚀 Installation

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- No backend server required (static HTML/CSS/JS)
- Internet connection for CDN libraries

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/SKC_Admissionpannel.git
   cd SKC_Admissionpannel
   ```

2. **Open in browser**
   - Double-click `index.html` to open locally, OR
   - Use a local server:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js (http-server)
   npx http-server
   ```

3. **Access the application**
   - Open `http://localhost:8000` in your browser

---

## 💻 Usage

### For Students

1. **Visit the home page** - Select your education level
2. **Choose admission type:**
   - School Admission
   - Junior College (F.Y.J.C or S.Y.J.C)
   - Degree College (First/Second/Third Year)
3. **Fill the enquiry form** with accurate information
4. **Accept the declaration** checkbox
5. **Submit** - Receive enquiry token on success page
6. **Download** success page as JPG (optional)

### For Administrators

1. **Login** - Use admin credentials
2. **View Enquiries** - See all submitted forms
3. **Search** - Filter by name, email, or mobile
4. **Download** - Export enquiry data as JSON
5. **Manage** - View detailed enquiry information

---

## 📝 Form Types

### School Admission
- Student Name, Email, Mobile
- School Details
- Academic Information
- Parent Contact Details

### F.Y.J.C (11th Standard)
- Student Information
- SSC Details (School, Year, Percentage)
- Subject Selection
- Board Information

### S.Y.J.C (12th Standard)
- Previous Year Details
- Current Subject Marks
- CGPI/Percentage
- Year of Passing (4-digit, 1947-2030)

### First Year Degree
- HSC/Equivalent Details
- Stream Selection
- Marks/CGPI
- Year of Passing

### Second Year Degree
- **Degree College Name***
- **Previous University*** (Mumbai, Pune, Allahabad, Delhi, Madras, Hyderabad, Gujarat)
- **Result Status*** (Pass/Failed)
- Semester-wise marks
- Year of Passing (FY)

### Third Year Degree
- All SY Degree fields
- Third Year specific marks
- CGPI tracking
- Year of Passing (FY & SY)

**\* Required fields**

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, CSS3, JavaScript (ES6 Modules) |
| **Styling** | Tailwind CSS v3 |
| **Icons** | SVG (inline) |
| **Libraries** | html2canvas, xlsx, jsPDF |
| **Security** | Client-side DevTools blocking |
| **Backend** | Firebase (optional - for data storage) |

### CDN Libraries Used
- Tailwind CSS: `https://cdn.tailwindcss.com`
- html2canvas: For screenshot generation
- XLSX: For Excel export
- jsPDF: For PDF generation

---

## 🔒 Security Features

### Implemented
- ✅ Right-click context menu disabled
- ✅ DevTools inspection blocked (F12, Ctrl+Shift+I, etc.)
- ✅ Code inspection prevention
- ✅ Form validation on client-side
- ✅ Input sanitization for special characters

### Recommended Backend Security
- 🔐 Use HTTPS only
- 🔐 Implement rate limiting
- 🔐 Server-side form validation
- 🔐 Encrypt sensitive data
- 🔐 Use environment variables for API keys

---

## 📱 Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | Latest | ✅ Full |
| Firefox | Latest | ✅ Full |
| Safari | 14+ | ✅ Full |
| Edge | Latest | ✅ Full |
| Opera | Latest | ✅ Full |
| IE 11 | - | ❌ Not supported |

---

## 🎨 Customization

### Change Logo
Replace `assets/SKC Logo.png` with your logo:
```html
<img src="./assets/your-logo.png" alt="Your Logo">
```

### Change School Name
Edit in `index.html`:
```html
<h1 class="text-4xl font-bold text-center text-blue-800">Your School Name</h1>
<p class="text-xl text-center text-gray-600">Your Tagline</p>
```

### Change Colors
Update Tailwind color classes (blue-600, blue-800, etc.) in `index.html` and `script.js`.

### Modify Form Fields
Edit the `getFyjcForm()`, `getSyjcForm()`, etc. functions in `script.js` to add/remove fields.

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Logo not loading | Check `assets/SKC Logo.png` path |
| Forms not responding | Hard reload (Ctrl+F5) |
| Data not submitting | Check browser console for errors |
| Styles not applying | Clear cache and reload |
| Year field errors | Ensure 4-digit input (1947-2030) |

---

## 📊 Data Validation Rules

### General Fields
- **Name**: Letters and spaces only
- **Email**: Valid email format required
- **Mobile**: 10 digits only
- **Percentage**: 0.00 - 99.99
- **CGPI**: 0.00 - 10.00

### Year Fields
- **Format**: 4 digits only
- **Range**: 1947 - 2030
- **Example**: 2024, 2025, 1995

### Required Fields
- All fields marked with `*` are mandatory
- Form cannot submit without required fields


---

## 📄 License

This project is proprietary to SKC Group of Institutions. Unauthorized copying or distribution is prohibited.

---

## 👥 Contributing

For feature requests or bug reports, please contact the development team.

---

## 🔄 Changelog

### Version 1.0.0 (Current)
- Initial release
- All form types implemented
- Admin panel functional
- Security features enabled

---

**Last Updated**: November 12, 2025

**👨‍💻 Author**
Developed by Jwala Yadav
Portfolio: jwala-yadav.netlify.app