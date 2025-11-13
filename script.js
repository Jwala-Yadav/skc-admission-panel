import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  serverTimestamp,
  getDocs,
  where,
  doc,         // <-- For Edits/Views
  getDoc,      // <-- For Edits/Views
  updateDoc    // <-- For Edits
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Config ---
// IMPORTANT: Replace this with your own Firebase project configuration!
// You can get this from the Firebase console:
// Project Settings > General > Your apps > Web app > Firebase SDK snippet > Config
// --- Config ---
// These variables will be securely injected by Netlify.
// This code will FAIL until you complete the Netlify steps.
const firebaseConfig = JSON.parse(__firebase_config);
const appId = __app_id;

// --- Global State ---
let G = {
  app: null,
  auth: null,
  db: null,
  user: null,
  currentView: 'public', 
  allEnquiries: [], 
  currentEnquiryForModal: null, // <-- For Download Modal
};

// --- UI Elements ---
let E = {};

// --- Constants ---
const BOARD_OPTIONS = ['Maharashtra Board', 'C.B.S.C', 'I.C.S.C', 'N.I.O.S', 'Other Board'];
const STREAM_OPTIONS = ['Science', 'Commerce', 'Arts'];
const DEGREE_COURSES = ['B.COM', 'B.M.S', 'B.Sc. IT', 'B.B.I', 'B.A.F', 'B.F.M'];
const GRADE_OPTIONS = ['Fresher', 'Nursery', 'Junior KG', 'Senior KG', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];
const ADMISSION_OPTIONS = ['Nursery', 'Junior KG', 'Senior KG', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];
const UNIVERSITY_OPTIONS = [
    'Mumbai University',
    'Pune University',
    'Allahabad University', 
    'Delhi University',
    'Madras University',
    'University of Hyderabad',
    'Gujarat University',
    'Other University'
];
const ADMISSION_STATUS_OPTIONS = ['Pending', 'Granted', 'Not Eligible'];

// --- Helper Functions ---

function getFormSection(formType) {
    if (formType === 'School') {
        return 'School';
    }
    if (formType.includes('J.C')) {
        return 'Junior College';
    }
    if (formType.includes('Degree')) {
        return 'Degree College';
    }
    return 'Unknown'; 
}

function showView(viewId) {
  if (!viewId) return;
  G.currentView = viewId;
  
  Object.values(E.views).forEach(view => {
    if (view && typeof view.classList !== 'undefined' && view.id !== 'error-view') {
        view.classList.remove('active');
    }
  });
  Object.values(E.views.forms).forEach(view => {
     if (view) view.classList.remove('active');
  });
  
  let viewToShow;
  if (E.views[viewId]) {
    viewToShow = E.views[viewId];
  } else if (E.views.forms[viewId]) { 
    viewToShow = E.views.forms[viewId];
  }
  
  if (viewToShow) {
    viewToShow.classList.add('active');
  } else {
    console.error(`View "${viewId}" not found.`);
    E.views.error.classList.add('active');
    E.errorMessage.textContent = `View "${viewId}" not found.`;
  }
  
  if (viewId === 'login' || viewId === 'admin' || viewId === 'adminAnalytics') { // <-- MODIFIED
    E.nav.loginBtn.classList.add('hidden');
  } else { 
    E.nav.loginBtn.classList.remove('hidden');
  }
}

/**
 * Universal Modal Controller
 * @param {string} title - The title for the modal header.
 * @param {string} content - The HTML content for the modal body.
 * @param {'info' | 'error' | 'edit' | 'view' | 'download'} type - The modal type.
 */
function showModal(title, content, type = 'info') {
  E.modal.title.textContent = title;
  E.modal.body.innerHTML = content;
  
  const actionBtn = E.modal.actionBtn;
  const titleEl = E.modal.title;
  
  // --- Reset all classes ---
  E.modal.el.classList.remove('modal-view', 'modal-edit');
  E.modal.footer.classList.remove('hidden');
  actionBtn.className = "w-full text-white font-bold py-2 px-4 rounded-lg transition-colors"; // Reset button classes
  titleEl.className = "text-xl font-semibold"; // Reset title classes
  
  // --- Remove old listener to prevent duplicates ---
  const newActionBtn = actionBtn.cloneNode(true); // Clone to remove listeners
  actionBtn.parentNode.replaceChild(newActionBtn, actionBtn);
  E.modal.actionBtn = newActionBtn; // Update reference
  
  // --- Apply type-specific classes ---
  switch (type) {
    case 'error':
      titleEl.classList.add('text-red-600');
      newActionBtn.classList.add('bg-red-600', 'hover:bg-red-700');
      newActionBtn.textContent = 'Close';
      E.modal.el.classList.add('modal-view'); // Standard width
      newActionBtn.addEventListener('click', hideModal);
      break;
      
    case 'edit':
      titleEl.classList.add('text-gray-800');
      E.modal.footer.classList.add('hidden'); // Edit form has its own button
      E.modal.el.classList.add('modal-edit'); // Wide width for form
      break;
      
    case 'view':
      titleEl.classList.add('text-gray-800');
      newActionBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
      newActionBtn.textContent = 'Close';
      E.modal.el.classList.add('modal-edit'); // Wide width for read-only form
      newActionBtn.addEventListener('click', hideModal);
      break;
      
    case 'download':
      titleEl.classList.add('text-green-800');
      newActionBtn.classList.add('bg-green-600', 'hover:bg-green-700');
      newActionBtn.textContent = 'Confirm Download';
      E.modal.el.classList.add('modal-view'); // Standard width for preview list
      // Add listener to download AND close
      newActionBtn.addEventListener('click', () => {
        if (G.currentEnquiryForModal) {
          handlePdfDownload(G.currentEnquiryForModal);
        }
        hideModal();
      });
      break;
      
    case 'info':
    default:
      titleEl.classList.add('text-gray-800');
      newActionBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
      newActionBtn.textContent = 'Close';
      E.modal.el.classList.add('modal-view'); // Standard width
      newActionBtn.addEventListener('click', hideModal);
      break;
  }
  
  E.modal.el.classList.add('active');
}

function hideModal() {
  E.modal.el.classList.remove('active');
  G.currentEnquiryForModal = null; // Clear the temp enquiry
  E.modal.body.innerHTML = ''; // Clear content
}

async function generateNewToken(formType) {
  let prefix = '';
  const collectionPath = `artifacts/${appId}/public/data/enquiries`;
  const formSection = getFormSection(formType);

  if (formSection === 'School') {
    prefix = 'S';
  } else if (formSection === 'Junior College') {
    prefix = 'J';
  } else if (formSection === 'Degree College') {
    prefix = 'DE';
  }
  
  const q = query(collection(G.db, collectionPath), where("formSection", "==", formSection));
  try {
    const snapshot = await getDocs(q);
    const count = snapshot.size + 1;
    const paddedCount = String(count).padStart(5, '0');
    return `${prefix}${paddedCount}_${new Date().getFullYear()}`;
  } catch (err) {
    console.error("Token generation error: ", err);
    return `${prefix}-${Date.now().toString().slice(-6)}`;
  }
}

function calculateAge(dateString) {
    if (!dateString) return '';
    try {
        const birthDate = new Date(dateString);
        const today = new Date();
        
        let years = today.getFullYear() - birthDate.getFullYear();
        let months = today.getMonth() - birthDate.getMonth();
        
        if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
            years--;
            months = 12 + months; 
        }
        
        if (isNaN(years) || years < 0) return 'Invalid Date';
        
        return `${years} Years, ${months} Months`;
    } catch (e) {
        return '';
    }
}

function renderFormView(pageId, formType) {
  const container = E.views.forms[pageId]; 
  if (!container) {
    console.error(`Form container #${pageId} not found in E.views.forms.`);
    return;
  }
  
  let formHTML = '';
  
  if (formType === 'School') {
    formHTML = getSchoolForm();
  } else if (formType === 'F.Y.J.C (11th)') {
    formHTML = getFyjcForm();
  } else if (formType === 'S.Y.J.C (12th)') {
    formHTML = getSyjcForm();
  } else if (formType === 'First Year Degree') {
    formHTML = getFyDegreeForm();
  } else if (formType === 'Second Year Degree') {
    formHTML = getSyDegreeForm();
  } else if (formType === 'Third Year Degree') {
    formHTML = getTyDegreeForm();
  }
  
  container.innerHTML = `
    <div class="w-full max-w-3xl mx-auto p-4 md:p-8">
      <button onclick="showView('public')" class="nav-back-home mb-4 text-blue-600 hover:text-blue-800 font-medium">
        &larr; Back to Home
      </button>
      <form id="${formType}-form" class="bg-white p-6 md:p-8 rounded-xl shadow-lg border border-gray-100" novalidate>
        <h2 class="text-3xl font-bold text-center text-blue-800 mb-2">SKC Enquiry Form</h2>
        <p class="text-xl font-semibold text-center text-gray-600 mb-8">${formType}</p>
        
        ${formHTML}
        
        <div class="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">Declaration</h3>
          <div class="flex items-start">
            <input type="checkbox" id="declaration" name="declaration" required class="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"/>
            <label for="declaration" class="ml-3 block text-sm text-gray-700">
              I hereby declare that all the information provided is true and correct. I understand that if any information is found to be false, my enquiry may be rejected. This is an enquiry, not a confirmation of admission.
              <br/>
              <strong class="text-gray-800">This enquiry is valid for 7 working days.</strong>
            </label>
          </div>
        </div>
        
        <button type="submit" class="submit-form-btn w-full mt-6 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 bg-blue-600 hover:bg-blue-700 shadow-md">
          Submit Enquiry
        </button>
      </form>
    </div>
  `;
  
  const backBtn = container.querySelector('.nav-back-home');
  if (backBtn) {
    backBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      showView('public');
    });
  }

  addFormListeners(pageId, formType, null, false); // false = not view only
  showView(pageId);
}

// --- Form Builder Functions (HTML Templates) ---

function getSchoolForm() {
  return `
    ${createInput('studentName', 'Student Name', 'text', true, null, 'Letters and spaces only', '', true)}
    ${createMobileInput('studentMobile', 'Student Contact Number', true)}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6">
      ${createInput('dob', 'Date of Birth (Student)', 'date', true)}
      ${createInput('calculatedAge', 'Calculated Age', 'text', false, null, null, '', false, null, false, true)} <!-- ReadOnly=true -->
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6">
      ${createSelect('nowStudying', 'Now Studying in Grade', GRADE_OPTIONS, true)}
      ${createSelect('admissionTo', 'Admission to class', ADMISSION_OPTIONS, true)}
    </div>
    
    <div id="school-conditional-fields" class="hidden">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        ${createInput('lyPercentage', 'Last Year Percentage', 'number', true, '0.00', '99.99', 'e.g., 85.50')}
        ${createRadioGroup('lyResult', 'Last Year Result', ['Pass', 'Fail'], true)}
      </div>
      ${createSelect('board', 'Board', BOARD_OPTIONS, true)}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-x-6">
        ${createInput('bc', 'Birth Certificate No.', 'text', false)}
        ${createInput('studentId', 'Student Id No.', 'text', false, null, 'Numbers only', '', false, null, true)}
        ${createInput('aadhar', 'Aadhar No.', 'tel', true, '[0-9]{12}', '12 digit number', '', false, 12, true)}
      </div>
      <h3 class="text-lg font-semibold text-gray-800 mb-2 mt-6">Previous School Info</h3>
      ${createInput('prevSchool', 'Existing / Previous School', 'text', true, null, 'Letters and spaces only', '', true)}
      ${createInput('schoolAddress', 'Brief Address of school', 'text', true)}
    </div>
    
    <div id="school-fresher-aadhar" class="hidden">
      ${createInput('aadhar_fresher', 'Aadhar No.', 'tel', true, '[0-9]{12}', '12 digit number', '', false, 12, true)}
    </div>
    
    ${createParentSection()}
    ${createAddressSection('residentialAddress', 'Residential Address', true)}
    <div id="eligibility-agreement-container"></div>
  `;
}

function getFyjcForm() {
  return `
    ${createInput('studentName', 'Student Name (as per 10th Mark Sheet)', 'text', true, null, 'Letters and spaces only', '', true)}
    ${createMobileInput('studentMobile', 'Student Contact Number', true)}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6">
      ${createInput('dob', 'Date of Birth (Student)', 'date', true)}
      ${createInput('aadhar', 'Aadhar No.', 'tel', true, '[0-9]{12}', '12 digit number', '', false, 12, true)}
    </div>
    ${createParentSection()}
    ${createInput('referredBy', 'Coaching Centre / Referred by', 'text', false)}
    ${createRadioGroup('preferredStream', 'Preferred Stream', STREAM_OPTIONS, true)}
    ${createSscSection(true, ['Pass', 'ATKT (Allowed to Keep Terms)'], true)}
    ${createInput('schoolAddress', 'Existing School Address', 'text', true, null, 'Letters and spaces only', '', true)}
    ${createAddressSection('residentialAddress', 'Residential Address', true)}
    <div id="eligibility-agreement-container"></div>
  `;
}

function getSyjcForm() {
    return `
    ${createInput('studentName', 'Student Name', 'text', true, null, 'Letters and spaces only', '', true)}
    ${createMobileInput('studentMobile', 'Student Contact Number', true)}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6">
      ${createInput('dob', 'Date of Birth (Student)', 'date', true)}
      ${createInput('aadhar', 'Aadhar No.', 'tel', true, '[0-9]{12}', '12 digit number', '', false, 12, true)}
    </div>
    ${createParentSection()}
    ${createInput('referredBy', 'Coaching Centre / Referred by', 'text', false)}
    ${createRadioGroup('preferredStream', 'Preferred Stream (for 12th)', STREAM_OPTIONS, true)}
    
    ${createSscSection(true, ['Pass'], true)}
    
    <div class="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 class="text-lg font-semibold text-gray-800 mb-4">Academic Details: FYJC (11th)</h3>
      ${createInput('fyjcCollege', 'College Name', 'text', true, null, 'Letters and spaces only', '', true)}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-x-6">
        ${createSelect('fyjcBoard', '11th Board', BOARD_OPTIONS, true)}
        ${createSelect('fyjcStream', '11th Stream', STREAM_OPTIONS, true)}
        ${createRadioGroup('fyjcResult', '11th Result Status', ['Pass', 'Fail'], true)}
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        ${createInput('fyjcPercentage', 'Percentage of 11th Board', 'number', true, '0.00', '99.99', 'e.g., 75.00')}
        ${createInput('fyjcYear', 'Year of Passing (11th)', 'tel', true, '[0-9]{4}', '4-digit year (1947-2030)', 'e.g., 2025', false, 4, true)}
      </div>
    </div>
    
    <div id="stream-mismatch-agreement-container"></div>
    
    ${createInput('fyCollegeAddress', 'Existing FY College Address', 'text', true, null, 'Letters and spaces only', '', true)}
    ${createAddressSection('residentialAddress', 'Residential Address', true)}
    <div id="eligibility-agreement-container"></div>
  `;
}

function getFyDegreeForm() {
    return `
    ${createInput('studentName', 'Student Name', 'text', true, null, 'Letters and spaces only', '', true)}
    ${createMobileInput('studentMobile', 'Student Contact Number', true)}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6">
      ${createInput('dob', 'Date of Birth (Student)', 'date', true)}
      ${createInput('aadhar', 'Aadhar No.', 'tel', true, '[0-9]{12}', '12 digit number', '', false, 12, true)}
    </div>
    ${createRadioGroup('course', 'Course Preferred (Choose only one)', DEGREE_COURSES, true)}
    ${createParentSection()}
    ${createSscSection(true, ['Pass'], true)}
    ${createHscSection(true)}
    
    ${createInput('existingAddress', 'Existing HSC College Address', 'text', true, null, 'Letters and spaces only', '', true)}
    ${createAddressSection('residentialAddress', 'Residential Address', true)}
    <div id="eligibility-agreement-container"></div>
  `;
}

function getSyDegreeForm() {
  return `
    ${createInput('studentName', 'Student Name', 'text', true, null, 'Letters and spaces only', '', true)}
    ${createMobileInput('studentMobile', 'Student Contact Number', true)}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6">
      ${createInput('dob', 'Date of Birth (Student)', 'date', true)}
      ${createInput('aadhar', 'Aadhar No.', 'tel', true, '[0-9]{12}', '12 digit number', '', false, 12, true)}
    </div>
    ${createRadioGroup('course', 'Course', DEGREE_COURSES, true)}
    ${createParentSection()}
    ${createSscSection(true, ['Pass'], true)}
    ${createHscSection(true)}
    
    <div class="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 class="text-lg font-semibold text-gray-800 mb-4">Academic Details: FY Degree College</h3>
      
      ${createInput('fyDegreeCollege', 'Degree College Name', 'text', true, null, 'Letters and spaces only', '', true)}
      
      ${createSelect('fyUniversity', 'Previous University', UNIVERSITY_OPTIONS, true)}
      <div id="other-university-agreement-container"></div>

      ${createRadioGroup('fyResult', 'Result Status', ['Pass', 'Failed'], true)}

      <fieldset class="mb-4 p-3 border rounded-md">
        <legend class="text-md font-medium text-gray-700 px-2">Semester - 1 *</legend>
        ${createRadioGroup('sem1Type', 'Result Type', ['Percentage', 'CGPI'], true)}
        <div class="grid grid-cols-2 gap-x-6">
          ${createInput('sem1Percentage', 'Percentage of Semester - 1', 'number', false, '0.00', '99.99', 'e.g., 75.50')}
          ${createInput('sem1Cgpi', 'SGPI of Semester - 1', 'number', false, '0.01', '10.00', 'e.g., 8.5')}
        </div>
      </fieldset>

      <fieldset class="mb-4 p-3 border rounded-md">
        <legend class="text-md font-medium text-gray-700 px-2">Semester - 2 *</legend>
        ${createRadioGroup('sem2Type', 'Result Type', ['Percentage', 'CGPI'], true)}
        <div class="grid grid-cols-2 gap-x-6">
          ${createInput('sem2Percentage', 'Percentage of Semester - 2', 'number', false, '0.00', '99.99', 'e.g., 75.50')}
          ${createInput('sem2Cgpi', 'SGPI of Semester - 2', 'number', false, '0.01', '10.00', 'e.g., 8.5')}
        </div>
      </fieldset>
      ${createInput('fyYear', 'Year of Passing (FY)', 'tel', true, '[0-9]{4}', '4-digit year (1947-2030)', 'e.g., 2024', false, 4, true)}
    </div>
    
    ${createInput('existingAddress', 'Existing Degree College Address', 'text', true, null, 'Letters and spaces only', '', true)}
    ${createAddressSection('residentialAddress', 'Residential Address', true)}
    <div id="eligibility-agreement-container"></div>
  `;
}

function getTyDegreeForm() {
    return `
    ${createInput('studentName', 'Student Name', 'text', true, null, 'Letters and spaces only', '', true)}
    ${createMobileInput('studentMobile', 'Student Contact Number', true)}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6">
      ${createInput('dob', 'Date of Birth (Student)', 'date', true)}
      ${createInput('aadhar', 'Aadhar No.', 'tel', true, '[0-9]{12}', '12 digit number', '', false, 12, true)}
    </div>
    ${createRadioGroup('course', 'Course', DEGREE_COURSES, true)}
    ${createParentSection()}
    
    ${createSscSection(true, ['Pass'], true)}
    ${createHscSection(true)}
    
    <div class="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 class="text-lg font-semibold text-gray-800 mb-4">Academic Details: FY Degree College</h3>
      
      ${createInput('fyDegreeCollege', 'FY Degree College Name', 'text', true, null, 'Letters and spaces only', '', true)}
      
      ${createSelect('fyUniversity', 'FY Previous University', UNIVERSITY_OPTIONS, true)}
      <div id="other-university-agreement-container"></div>

      ${createRadioGroup('fyResult', 'FY Result Status', ['Pass', 'Failed'], true)}

      <fieldset class="mb-4 p-3 border rounded-md">
        <legend class="text-md font-medium text-gray-700 px-2">Semester - 1 *</legend>
        ${createRadioGroup('sem1Type', 'Result Type', ['Percentage', 'CGPI'], true)}
        <div class="grid grid-cols-2 gap-x-6">
          ${createInput('sem1Percentage', 'Percentage of Semester - 1', 'number', false, '0.00', '99.99', 'e.g., 75.50')}
          ${createInput('sem1Cgpi', 'SGPI of Semester - 1', 'number', false, '0.01', '10.00', 'e.g., 8.5')}
        </div>
      </fieldset>

      <fieldset class="mb-4 p-3 border rounded-md">
        <legend class="text-md font-medium text-gray-700 px-2">Semester - 2 *</legend>
        ${createRadioGroup('sem2Type', 'Result Type', ['Percentage', 'CGPI'], true)}
        <div class="grid grid-cols-2 gap-x-6">
          ${createInput('sem2Percentage', 'Percentage of Semester - 2', 'number', false, '0.00', '99.99', 'e.g., 75.50')}
          ${createInput('sem2Cgpi', 'SGPI of Semester - 2', 'number', false, '0.01', '10.00', 'e.g., 8.5')}
        </div>
      </fieldset>
      ${createInput('fyYear', 'Year of Passing (FY)', 'tel', true, '[0-9]{4}', '4-digit year (1947-2030)', 'e.g., 2024', false, 4, true)}
    </div>

    <div class="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 class="text-lg font-semibold text-gray-800 mb-4">Academic Details: SY Degree College</h3>
      
      ${createInput('syDegreeCollege', 'SY Degree College Name', 'text', true, null, 'Letters and spaces only', '', true)}
      
      ${createSelect('syUniversity', 'SY Previous University', UNIVERSITY_OPTIONS, true)}
      <div id="other-sy-university-agreement-container"></div> 
      
      ${createRadioGroup('syResult', 'SY Result Status', ['Pass', 'Failed'], true)}

      <fieldset class="mb-4 p-3 border rounded-md">
        <legend class="text-md font-medium text-gray-700 px-2">Semester - 3 *</legend>
        ${createRadioGroup('sem3Type', 'Result Type', ['Percentage', 'CGPI'], true)}
        <div class="grid grid-cols-2 gap-x-6">
          ${createInput('sem3Percentage', 'Percentage of Semester - 3', 'number', false, '0.00', '99.99', 'e.g., 75.50')}
          ${createInput('sem3Cgpi', 'SGPI of Semester - 3', 'number', false, '0.01', '10.00', 'e.g., 8.5')}
        </div>
      </fieldset>
      <fieldset class="mb-4 p-3 border rounded-md">
        <legend class="text-md font-medium text-gray-700 px-2">Semester - 4 *</legend>
        ${createRadioGroup('sem4Type', 'Result Type', ['Percentage', 'CGPI'], true)}
        <div class="grid grid-cols-2 gap-x-6">
          ${createInput('sem4Percentage', 'Percentage of Semester - 4', 'number', false, '0.00', '99.99', 'e.g., 75.50')}
          ${createInput('sem4Cgpi', 'SGPI of Semester - 4', 'number', false, '0.01', '10.00', 'e.g., 8.5')}
        </div>
      </fieldset>
      ${createInput('syYear', 'Year of Passing (SY)', 'tel', true, '[0-9]{4}', '4-digit year (1947-2030)', 'e.g., 2025', false, 4, true)}
    </div>
    
    ${createInput('existingAddress', 'Existing Degree College Address', 'text', true, null, 'Letters and spaces only', '', true)}
    ${createAddressSection('residentialAddress', 'Residential Address', true)}
    <div id="eligibility-agreement-container"></div>
  `;
}

// --- Component Builder Functions ---

/**
 * Creates an HTML input field.
 * @param {string} id - The ID and name of the input.
 * @param {string} label - The label text.
 * @param {string} type - The input type (e.g., 'text', 'number', 'date', 'tel').
 * @param {boolean} required - Whether the field is required.
 * @param {string | null} minOrPattern - For 'number', the min value. For 'tel' or 'text', the regex pattern.
 * @param {string | null} maxOrTitle - For 'number', the max value. For 'tel' or 'text', the validation title.
 * @param {string} placeholder - The placeholder text.
 * @param {boolean} isName - If true, applies name validation (letters, spaces, dots).
 * @param {number | null} maxLength - The maximum length for the input.
 * @param {boolean} isNumeric - If true, applies numeric-only validation (for tel inputs).
 * @param {boolean} readOnly - If true, makes the field read-only.
 */
function createInput(id, label, type, required, minOrPattern, maxOrTitle, placeholder = '', isName = false, maxLength = null, isNumeric = false, readOnly = false) {
  
  let title = maxOrTitle || (isName ? 'Letters, dots, and spaces only' : '');
  let pattern = isName ? '^[A-Za-z .]+$' : (type !== 'number' ? minOrPattern : null);
  const min = type === 'number' ? minOrPattern : null;
  const max = type === 'number' ? maxOrTitle : null;
  let step = null;

  // ***FIX 2: Add step="0.01" for number fields that use decimals***
  if (type === 'number') {
    if (String(minOrPattern).includes('.') || String(maxOrTitle).includes('.')) {
      step = '0.01'; // Allow decimals
    }
  }
  
  // Specific logic for 'tel' inputs
  if (type === 'tel') {
     if (maxLength === 10) {
        // Standard mobile number
        title = 'Must be a 10-digit number';
        pattern = '[0-9]{10}';
     } else if (isNumeric) {
        // Other numeric fields like Year or Pincode
        title = maxOrTitle; // Use the provided title (e.g., '6-digit number' or '4-digit year')
        pattern = minOrPattern; // Use the provided pattern (e.g., '[0-9]{6}' or '[0-9]{4}')
     }
  }
  
  return `
    <div class="mb-4">
      <label for="${id}" class="block text-sm font-medium text-gray-700 mb-1">${label} ${required ? '<span class="text-red-500">*</span>' : ''}</label>
      <input
        type="${type}"
        id="${id}"
        name="${id}"
        placeholder="${placeholder || `Enter ${label.toLowerCase()}`}"
        ${required ? 'required' : ''}
        ${pattern ? `pattern="${pattern}"` : ''}
        ${title ? `title="${title}"` : ''}
        ${maxLength ? `maxlength="${maxLength}"` : ''}
        ${min ? `min="${min}"` : ''}
        ${max ? `max="${max}"` : ''}
        ${step ? `step="${step}"` : ''} 
        ${isName ? 'data-is-name="true"' : ''}
        ${isNumeric ? 'data-is-numeric="true"' : ''}
        ${readOnly ? 'readonly' : ''}
        class="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${readOnly ? 'bg-gray-100' : ''}"
      />
    </div>
  `;
}

function createMobileInput(id, label, required) {
  return `
    <div class="mb-4">
      <label for="${id}" class="block text-sm font-medium text-gray-700 mb-1">${label} ${required ? '<span class="text-red-500">*</span>' : ''}</label>
      <input
        type="tel"
        id="${id}"
        name="${id}"
        placeholder="10-digit mobile number"
        ${required ? 'required' : ''}
        pattern="[0-9]{10}"
        title="Must be a 10-digit number"
        maxlength="10"
        class="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div class="mt-2 flex items-center">
        <input type="checkbox" id="${id}-whatsapp" name="${id}-whatsapp" class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>
        <label for="${id}-whatsapp" class="ml-2 block text-sm text-gray-700">This number is available on WhatsApp</label>
      </div>
    </div>
  `;
}

function createSelect(id, label, options, required) {
  const optionsHTML = options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
  return `
    <div class="mb-4">
      <label for="${id}" class="block text-sm font-medium text-gray-700 mb-1">${label} ${required ? '<span class="text-red-500">*</span>' : ''}</label>
      <select id="${id}" name="${id}" ${required ? 'required' : ''} class="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
        <option value="">-- Select --</option>
        ${optionsHTML}
      </select>
    </div>
  `;
}

function createRadioGroup(name, label, options, required) {
  const optionsHTML = options.map(opt => `
    <label class="flex items-center space-x-2 p-2 rounded-md bg-white border border-gray-200 cursor-pointer">
      <input type="radio" name="${name}" value="${opt}" ${required ? 'required' : ''} class="text-blue-600 focus:ring-blue-500"/>
      <span class="text-sm font-medium text-gray-700">${opt}</span>
    </label>
  `).join('');
  return `
    <div class="my-4 p-4 border rounded-lg bg-gray-50">
      <label class="block text-sm font-medium text-gray-700 mb-2">${label} ${required ? '<span class="text-red-500">*</span>' : ''}</label>
      <div class="flex flex-wrap gap-3">
        ${optionsHTML}
      </div>
    </div>
  `;
}

function createParentSection() {
  return `
    <div class="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 class="text-lg font-semibold text-gray-800 mb-4">Parent Info</h3>
      ${createParentFields('father', true)}
      ${createParentFields('mother', true)} 
    </div>
  `;
}

function createParentFields(type, required) {
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 border-b border-gray-200 py-2 last:border-b-0">
      ${createInput(`${type}Name`, `${type.charAt(0).toUpperCase() + type.slice(1)}'s Name`, 'text', required, null, 'Letters and spaces only', '', true)}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        ${createInput(`${type}Occupation`, 'Occupation', 'text', required, null, 'Letters and spaces only', '', true)}
        ${createMobileInput(`${type}Mobile`, 'Mobile No.', required)}
      </div>
    </div>
  `;
}

function createAddressSection(id, title, required) {
    return `
    <div class="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 class="text-lg font-semibold text-gray-800 mb-4">${title} ${required ? '<span class="text-red-500">*</span>' : ''}</h3>
      ${createInput(`${id}Line`, 'Address Line (Street, Area)', 'text', required)}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-x-6">
        ${createInput(`${id}City`, 'City', 'text', required, null, 'Letters and spaces only', '', true)}
        ${createInput(`${id}State`, 'State', 'text', required, null, 'Letters and spaces only', 'Maharashtra', true)}
        ${createInput(`${id}Pincode`, 'Pincode', 'tel', required, '[0-9]{6}', '6-digit number', '', false, 6, true)}
      </div>
      ${createInput(`${id}Landmark`, 'Landmark', 'text', false)}
    </div>
   `;
}

function createSscSection(required, resultOptions, showSeatNumber = false) {
  return `
    <div class="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 class="text-lg font-semibold text-gray-800 mb-4">Academic Details: SSC (10th Board)</h3>
      ${createInput('sscSchool', 'School/College Name', 'text', required, null, 'Letters and spaces only', '', true)}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        ${createSelect('sscBoard', '10th Board', BOARD_OPTIONS, required)}
        ${createRadioGroup('sscResult', 'Result Status', resultOptions, required)}
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        ${createInput('sscPercentage', 'Percentage of 10th Board', 'number', required, '0.00', '99.99', 'e.g., 85.50')}
        ${createInput('sscYear', 'Year of Passing', 'tel', true, '[0-9]{4}', '4-digit year (1947-2030)', 'e.g., 2022', false, 4, true)}
      </div>
      ${showSeatNumber ? createInput('sscSeatNumber', '10th Board Seat No.', 'text', required, '[A-Za-z0-9]+', 'Alphanumeric, e.g., A123456', 'e.g., A123456') : ''}
    </div>
  `;
}

function createHscSection(required) {
  return `
    <div class="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 class="text-lg font-semibold text-gray-800 mb-4">Academic Details: HSC (12th Board)</h3>
      ${createInput('hscSchool', 'School/College Name', 'text', required, null, 'Letters and spaces only', '', true)}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-x-6">
        ${createSelect('hscBoard', '12th Board', BOARD_OPTIONS, required)}
        ${createSelect('hscStream', 'Stream', STREAM_OPTIONS, required)}
        ${createRadioGroup('hscResult', 'Result Status', ['Pass'], required)}
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        ${createInput('hscPercentage', 'Percentage of 12th Board', 'number', required, '0.00', '99.99', 'e.g., 85.50')}
        ${createInput('hscYear', 'Year of Passing', 'tel', true, '[0-9]{4}', '4-digit year (1947-2030)', 'e.g., 2024', false, 4, true)}
      </div>
      ${createInput('hscSeatNumber', '12th Board Seat No.', 'text', required, '[A-Za-z0-9]+', 'Alphanumeric, e.g., M123456', 'e.g., M123456')}
    </div>
  `;
}

function getFormData(form) {
  const data = {};
  const inputs = form.querySelectorAll('input, select, textarea');

  inputs.forEach(input => {
    if (!input.id || input.disabled) return;
    const id = input.id;

    if (input.type === 'checkbox') {
      data[id] = !!input.checked;
      return;
    }

    // This block is intentionally removed. Radio buttons are handled AFTER the loop.

    if (input.dataset.isNumeric === 'true' || input.type === 'tel' || input.inputMode === 'numeric') {
      const digits = (input.value || '').toString().replace(/[^0-9]/g, '');
      data[id] = digits === '' ? undefined : digits;
      return;
    }

    if (input.dataset.isName === 'true') {
      data[id] = input.value.trim().replace(/\s+/g, ' ') || undefined;
      return;
    }

    data[id] = input.value === '' ? undefined : input.value;
  });

  // --- FIX FOR RADIO BUTTONS ---
  // Get all unique radio button group names
  const radioNames = [...new Set(
      Array.from(form.querySelectorAll('input[type="radio"]'))
           .map(r => r.name)
  )];

  radioNames.forEach(name => {
      if (!name) return; // Skip if a radio has no name
      const checkedRadio = form.querySelector(`input[name="${name}"]:checked`);
      if (checkedRadio) {
          data[name] = checkedRadio.value;
      } else {
          // Only set to undefined if it's not already set
          if (!data.hasOwnProperty(name)) {
            data[name] = undefined;
          }
      }
  });
  // --- END FIX ---

  // Handle mobile numbers with WhatsApp checkbox
  // Use a safe getter to avoid errors if data is missing
  const get = (key) => data[key] || undefined;

  const studentMobile = get('studentMobile');
  const fatherMobile = get('fatherMobile');
  const motherMobile = get('motherMobile');

  data.studentMobile = {
    number: studentMobile || '',
    isWhatsapp: !!get('studentMobile-whatsapp')
  };

  data.fatherMobile = {
    number: fatherMobile || '',
    isWhatsapp: !!get('fatherMobile-whatsapp')
  };

  data.motherMobile = {
    number: motherMobile || '',
    isWhatsapp: !!data['motherMobile-whatsapp']
  };

  // Handle parent info
  data.parentInfo = {
    father: {
      name: get('fatherName') || '',
      occupation: get('fatherOccupation') || '',
      mobile: data.fatherMobile
    },
    mother: {
      name: get('motherName') || '',
      occupation: get('motherOccupation') || '',
      mobile: data.motherMobile
    }
  };

  // Handle address
  data.residentialAddress = {
    line: data.residentialAddressLine || '',
    city: get('residentialAddressCity') || '',
    state: get('residentialAddressState') || '',
    pincode: get('residentialAddressPincode') || '',
    landmark: get('residentialAddressLandmark') || ''
  };

  // Clean undefined values
  function deepClean(value) {
    if (value === undefined) return null;
    if (value === null) return null;
    if (Array.isArray(value)) return value.map(deepClean);
    if (typeof value === 'object') {
      const out = {};
      Object.entries(value).forEach(([k, v]) => {
        out[k] = deepClean(v);
      });
      return out;
    }
    return value;
  }

  return deepClean({
    studentName: data.studentName || '',
    studentMobile: data.studentMobile,
    dob: data.dob || '',
    aadhar: data.aadhar || data.aadhar_fresher || '',
    parentInfo: data.parentInfo,
    residentialAddress: data.residentialAddress,
    declaration: !!data.declaration,
    ...getFormSpecificData(data)
  });
}

function getFormSpecificData(data) {
  const specificData = {};
  
  // School
  if (data.nowStudying) {
    specificData.nowStudying = data.nowStudying;
    // ***FIX 1: Capture 'admissionTo' for all school students, including 'Fresher'***
    specificData.admissionTo = data.admissionTo; 
    
    if(data.nowStudying !== 'Fresher') {
      // These fields only apply to non-freshers
      specificData.lyPercentage = data.lyPercentage;
      specificData.lyResult = data.lyResult;
      specificData.board = data.board;
      specificData.bc = data.bc;
      specificData.studentId = data.studentId;
      specificData.prevSchool = data.prevSchool;
      specificData.schoolAddress = data.schoolAddress;
    }
  }
  
  // JC
  if (data.preferredStream) specificData.preferredStream = data.preferredStream;
  if (data.referredBy) specificData.referredBy = data.referredBy;
  if (data.sscBoard) {
    specificData.sscDetails = {
      school: data.sscSchool, board: data.sscBoard, result: data.sscResult,
      percentage: data.sscPercentage, year: data.sscYear,
      seatNumber: data.sscSeatNumber 
    };
  }
  if (data.schoolAddress) specificData.schoolAddress = data.schoolAddress; // For FYJC
  if (data.fyjcBoard) {
    specificData.fyjcDetails = {
      college: data.fyjcCollege, board: data.fyjcBoard, stream: data.fyjcStream,
      result: data.fyjcResult, percentage: data.fyjcPercentage, year: data.fyjcYear
    };
    specificData.fyCollegeAddress = data.fyCollegeAddress; // For SYJC
  }
  
  // Degree
  if (data.course) specificData.course = data.course;
  if (data.hscBoard) {
    specificData.hscDetails = {
      school: data.hscSchool, board: data.hscBoard, stream: data.hscStream,
      result: data.hscResult, percentage: data.hscPercentage, year: data.hscYear,
      seatNumber: data.hscSeatNumber // <-- ADDED
    };
  }
  if (data.existingAddress) specificData.existingAddress = data.existingAddress; // For Degree
  
  // FY Degree Details (Used in SY and TY forms)
  // --- FIX: Changed check from data.sem1Type to data.fyDegreeCollege ---
  if(data.fyDegreeCollege) { 
    specificData.fyDetails = {
      college: data.fyDegreeCollege, 
      university: data.fyUniversity, 
      result: data.fyResult, 
      sem1: data.sem1Type === 'Percentage' ? { type: 'Percentage', value: data.sem1Percentage } : { type: 'CGPI', value: data.sem1Cgpi },
      sem2: data.sem2Type === 'Percentage' ? { type: 'Percentage', value: data.sem2Percentage } : { type: 'CGPI', value: data.sem2Cgpi },
      year: data.fyYear
    };
  }
  
  // SY Degree Details (Used in TY form)
  // --- FIX: Changed check from data.sem3Type to data.syDegreeCollege ---
  if(data.syDegreeCollege) { 
     specificData.syDetails = {
      college: data.syDegreeCollege, 
      university: data.syUniversity, 
      result: data.syResult,       
      sem3: data.sem3Type === 'Percentage' ? { type: 'Percentage', value: data.sem3Percentage } : { type: 'CGPI', value: data.sem3Cgpi },
      sem4: data.sem4Type === 'Percentage' ? { type: 'Percentage', value: data.sem4Percentage } : { type: 'CGPI', value: data.sem4Cgpi },
      year: data.syYear
    };
  }
  
  if (data.eligibilityAgreement) specificData.agreedToEligibility = data.eligibilityAgreement;
  if (data.otherUniversityAgreement) specificData.agreedToOtherUniversity = data.otherUniversityAgreement;
  if (data.otherSYUniversityAgreement) specificData.agreedToSYOtherUniversity = data.otherSYUniversityAgreement; 
  if (data.streamMismatchAgreement) specificData.agreedToStreamMismatch = data.streamMismatchAgreement;

  return specificData;
}

function renderAdminTable() {
  const term = E.adminView.searchTerm.value.toLowerCase();
  const field = E.adminView.searchField.value;
  const statusFilter = E.adminView.filterByStatus.value;
  
  const filtered = G.allEnquiries.filter(enq => {
    // Status Filter
    if (statusFilter !== 'All') {
        const status = enq.admissionStatus || 'Pending';
        if (statusFilter === 'Pending' && status !== 'Pending') return false;
        if (statusFilter === 'Granted' && status !== 'Granted') return false;
        if (statusFilter === 'Not Eligible' && status !== 'Not Eligible') return false;
    }

    // Search Filter
    if (!term) return true;
    if (field === 'studentName') return enq.studentName?.toLowerCase().includes(term);
    if (field === 'tokenization') return enq.tokenization?.toLowerCase().includes(term);
    if (field === 'aadhar') return enq.aadhar?.includes(term);
    if (field === 'parentMobile') {
      return enq.studentMobile?.number?.includes(term) ||
             enq.parentInfo?.father?.mobile?.number?.includes(term) ||
             enq.parentInfo?.mother?.mobile?.number?.includes(term);
    }
    return false;
                     });
  
  if (filtered.length === 0) {
    E.adminView.tableBody.innerHTML = `<tr><td colspan="8" class="text-center p-10 text-gray-500">No submissions found.</td></tr>`;
    return;
  }
  
  E.adminView.tableBody.innerHTML = filtered.map(enq => {
    const status = enq.admissionStatus || 'Pending';
    let statusColor = 'text-yellow-600';
    if (status === 'Granted') statusColor = 'text-green-600';
    if (status === 'Not Eligible') statusColor = 'text-red-600';
    
    return `
    <tr class="hover:bg-gray-50">
      <td data-label="Token ID" class="px-6 py-4 text-sm font-medium text-blue-600">${enq.tokenization || 'N/A'}</td>
      <td data-label="Student Name" class="px-6 py-4 text-sm text-gray-800">${enq.studentName || 'N/A'}</td>
      <td data-label="Form Type" class="px-6 py-4 text-sm text-gray-600">${enq.formType || 'N/A'}</td>
      <td data-label="Submission Date" class="px-6 py-4 text-sm text-gray-600">${enq.submittedAt ? new Date(enq.submittedAt.seconds * 1000).toLocaleString() : 'N/A'}</td>
      <td data-label="Status" class="px-6 py-4 text-sm ${statusColor}">
        <select class="admin-status-select w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${statusColor}" data-id="${enq.id}">
          <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Granted" ${status === 'Granted' ? 'selected' : ''}>Admission Granted</option>
          <option value="Not Eligible" ${status === 'Not Eligible' ? 'selected' : ''}>Not Eligible</option>
        </select>
      </td>
      <td data-label="Admission Form No." class="px-6 py-4 text-sm">
        <input 
          type="text" 
          class="admin-form-no-input w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
          data-id="${enq.id}" 
          value="${enq.admissionFormNo || ''}"
          placeholder="Enter form no..."
        />
      </td>
      <td data-label="Actions" class="px-6 py-4 text-sm font-medium">
        <div class="flex flex-col space-y-1 items-start">
            <button class="admin-view-details text-blue-600 hover:text-blue-800" data-id="${enq.id}" data-form-type="${enq.formType}">View</button>
            <button class="admin-edit-details text-yellow-600 hover:text-yellow-800" data-id="${enq.id}" data-form-type="${enq.formType}">Edit</button>
            <button class="admin-download-pdf text-green-600 hover:text-green-800" data-id="${enq.id}">Download PDF</button>
        </div>
      </td>
    </tr>
  `}).join('');
}

/**
 * This is the "Download Preview" modal content (the clean list).
 */
function renderAdminDetails(enquiry) {
    let content = '';
    
    function renderValue(key, value, level = 0) {
        // Clean up keys to ignore
        const ignoreKeys = ['declaration', 'allMobileNumbers', 'studentNameLower', 'submittedForm', 'formSection', 'lastEditedAt'];
        if (value === null || value === undefined || value === '' || ignoreKeys.includes(key) || key.startsWith('agreedTo')) return;
        
        let label = key.replace(/([A-Z])/g, ' $1');
        label = label.charAt(0).toUpperCase() + label.slice(1);

        const padding = `style="padding-left: ${level * 16}px;"`;
        
        if (typeof value === 'object' && !Array.isArray(value) && !value.seconds) {
            if (value.hasOwnProperty('number') && value.hasOwnProperty('isWhatsapp')) {
                 let displayValue = `${value.number || 'N/A'} ${value.isWhatsapp ? '(WhatsApp)' : ''}`;
                 content += `
                   <div class="flex justify-between py-1 border-b" ${padding}>
                       <span class="text-sm font-medium text-gray-500 capitalize">${label}:</span>
                       <span class="text-sm text-gray-800 text-right">${displayValue}</span>
                   </div>
                 `;
            } else if (value.hasOwnProperty('type') && value.hasOwnProperty('value')) {
                let displayValue = `${value.value || 'N/A'} ${value.type === 'CGPI' ? 'CGPI' : '%'}`;
                 content += `
                   <div class="flex justify-between py-1 border-b" ${padding}>
                       <span class="text-sm font-medium text-gray-500 capitalize">${label}:</span>
                       <span class="text-sm text-gray-800 text-right">${displayValue}</span>
                   </div>
                 `;
            } else {
                 content += `<h4 class="font-semibold text-gray-700 capitalize mt-2" ${padding}>${label}</h4>`;
                 Object.entries(value).forEach(([subKey, subValue]) => renderValue(subKey, subValue, level + 1));
            }
        } else {
            let displayValue = value.seconds ? new Date(value.seconds * 1000).toLocaleString() : String(value);
            
            content += `
              <div class="flex justify-between py-1 border-b" ${padding}>
                  <span class="text-sm font-medium text-gray-500 capitalize">${label}:</span>
                  <span class="text-sm text-gray-800 text-right">${displayValue}</span>
              </div>
            `;
        }
    }
    
    // Render all fields
    Object.entries(enquiry).filter(([k]) => k !== 'id').forEach(([key, value]) => renderValue(key, value));
    
    // Manually add agreements at the end
    content += `<h4 class="font-semibold text-gray-700 capitalize mt-2">Agreements</h4>`;
    const agreements = [
        { label: 'Agreed to Terms', value: enquiry.declaration },
        { label: 'Agreed (Non-MH Board)', value: enquiry.agreedToEligibility },
        { label: 'Agreed (Other Uni)', value: enquiry.agreedToOtherUniversity },
        { label: 'Agreed (SY Other Uni)', value: enquiry.agreedToSYOtherUniversity },
        { label: 'Agreed (Stream Mismatch)', value: enquiry.agreedToStreamMismatch }
    ];
    agreements.forEach(agg => {
        // Only show agreements that are relevant (not null/undefined)
        if (agg.value !== null && agg.value !== undefined) {
             content += `
               <div class="flex justify-between py-1 border-b" style="padding-left: 16px;">
                   <span class="text-sm font-medium text-gray-500 capitalize">${agg.label}:</span>
                   <span class="text-sm text-gray-800 text-right">${agg.value ? 'Yes' : 'No'}</span>
               </div>
             `;
        }
    });

    return content;
}

function downloadSuccessJPG() {
  if (window.html2canvas) {
    html2canvas(E.successPage.card, { scale: 2 }).then(canvas => {
      const imgData = canvas.toDataURL('image/jpeg');
      const link = document.createElement('a');
      link.download = `${E.successPage.token.textContent.trim()}_SKC_Enquiry.jpg`;
      link.href = imgData;
      link.click();
    });
  } else {
    alert("Could not download JPG. Library not loaded.");
  }
}

/**
 * FIXED: PDF Download now includes ALL fields and handles text wrapping.
 */
function handlePdfDownload(enq) {
    if (!window.jspdf) {
        alert('PDF library not loaded.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let yPos = 20;
    const indentStep = 5; 
    const leftMargin = 14;
    
    // --- Add Logo ---
    try {
        const logoImg = E.nav.logo; // Get the loaded logo from the main page
        const canvas = document.createElement('canvas');
        canvas.width = logoImg.naturalWidth;
        canvas.height = logoImg.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(logoImg, 0, 0);
        const logoDataUrl = canvas.toDataURL('image/png');
        
        doc.addImage(logoDataUrl, 'PNG', 160, 10, 30, 30);
    } catch(e) {
        console.error("Error adding logo to PDF:", e);
    }
    
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('SKC Enquiry Submission', leftMargin, yPos);
    yPos += 10;
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    yPos = 50; // Start content below logo

    /**
     * FIXED: addLine function to handle wrapping labels and boolean values.
     */
    function addLine(label, value, indent = 0) {
        // --- NEW: Explicitly handle boolean/undefined values ---
        let displayValue;
        if (value === true) {
            displayValue = 'Yes';
        } else if (value === false || value === null || value === undefined) {
            displayValue = 'No'; // Default to 'No' if not present or false
        } else {
            displayValue = String(value); // Use the string value
        }

        if (displayValue === '') return; // Don't print empty strings

        const xPos = leftMargin + (indent * indentStep);
        const xPosValue = leftMargin + 65; // <-- Increased space for labels
        const labelWidth = xPosValue - xPos - 2; // Width for label (with 2 unit padding)
        const valueWidth = doc.internal.pageSize.getWidth() - xPosValue - leftMargin;

        doc.setFont(undefined, 'bold');
        const splitLabel = doc.splitTextToSize(`${label}:`, labelWidth);
        doc.text(splitLabel, xPos, yPos);

        doc.setFont(undefined, 'normal');
        const splitValue = doc.splitTextToSize(displayValue, valueWidth);
        
        // Calculate yPos based on the taller of the label or value
        const labelLines = splitLabel.length;
        const valueLines = splitValue.length;
        const startYValue = yPos; // Both start at the same Y
        
        doc.text(splitValue, xPosValue, startYValue);
        
        const lineSpacing = 5; // roughly
        yPos += (Math.max(labelLines, valueLines) * lineSpacing) + 4; // Adjust spacing

        // Check for page break
        if (yPos > 280) {
            doc.addPage();
            yPos = 20;
        }
    }
    
    function addHeader(title, indent = 0) {
        if (yPos > 270) { // Check before adding header
            doc.addPage();
            yPos = 20;
        }
        yPos += 5;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(14);
        doc.text(title, leftMargin + (indent * indentStep), yPos);
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        yPos += 8;
    }
    
    addHeader('Submission Details');
    addLine('Token ID', enq.tokenization);
    addLine('Form Type', enq.formType);
    addLine('Submission Date', enq.submittedAt ? new Date(enq.submittedAt.seconds * 1000).toLocaleString() : 'N/A');
    addLine('Admission Status', enq.admissionStatus || 'Pending');
    addLine('Admission Form No', enq.admissionFormNo);

    addHeader('Student Information');
    addLine('Student Name', enq.studentName);
    addLine('Student Mobile', `${enq.studentMobile?.number || 'N/A'} ${enq.studentMobile?.isWhatsapp ? '(WhatsApp)' : ''}`);
    addLine('Date of Birth', enq.dob);
    addLine('Aadhar No', enq.aadhar);
    addLine('Course', enq.course); // <-- FIX: Moved here to match form order

    addHeader('Parent Information');
    addLine('Father Name', enq.parentInfo?.father?.name);
    addLine('Father Mobile', `${enq.parentInfo?.father?.mobile?.number || 'N/A'} ${enq.parentInfo?.father?.mobile?.isWhatsapp ? '(WhatsApp)' : ''}`);
    addLine('Father Occupation', enq.parentInfo?.father?.occupation);
    addLine('Mother Name', enq.parentInfo?.mother?.name);
    addLine('Mother Mobile', `${enq.parentInfo?.mother?.mobile?.number || 'N/A'} ${enq.parentInfo?.mother?.mobile?.isWhatsapp ? '(WhatsApp)' : ''}`);
    addLine('Mother Occupation', enq.parentInfo?.mother?.occupation);
    
    addHeader('Academic Details');
    addLine('Preferred Stream', enq.preferredStream); // JC
    addLine('Referred By', enq.referredBy); // JC
    // addLine('Course', enq.course); // <-- FIX: Removed from here

    if(enq.formSection === 'School') {
        addLine('Now Studying', enq.nowStudying);
        // ***FIX 1 (in PDF): Show Admission To for all school students***
        addLine('Admission To', enq.admissionTo); 
        if (enq.nowStudying !== 'Fresher') {
            addLine('Last Year %', enq.lyPercentage);
            addLine('Last Year Result', enq.lyResult);
            addLine('Board', enq.board);
            addLine('Birth Cert. No', enq.bc);
            addLine('Student ID', enq.studentId);
            addLine('Previous School', enq.prevSchool);
            addLine('School Address', enq.schoolAddress);
        }
    }
    
    if(enq.sscDetails) {
        addHeader('SSC (10th) Details', 1);
        addLine('School', enq.sscDetails.school, 1);
        addLine('Board', enq.sscDetails.board, 1);
        addLine('Seat No', enq.sscDetails.seatNumber, 1); 
        addLine('Result', enq.sscDetails.result, 1);
        addLine('Percentage', enq.sscDetails.percentage, 1);
        addLine('Year', enq.sscDetails.year, 1);
        if(enq.formType === 'F.Y.J.C (11th)') {
            addLine('School Address', enq.schoolAddress, 1); // FYJC School Address
        }
    }
    
    if(enq.hscDetails) {
        addHeader('HSC (12th) Details', 1);
        addLine('College', enq.hscDetails.school, 1);
        addLine('Board', enq.hscDetails.board, 1);
        addLine('Seat No', enq.hscDetails.seatNumber, 1); // <-- ADDED
        addLine('Stream', enq.hscDetails.stream, 1);
        addLine('Result', enq.hscDetails.result, 1);
        addLine('Percentage', enq.hscDetails.percentage, 1);
        addLine('Year', enq.hscDetails.year, 1);
    }

    if(enq.fyjcDetails) {
        addHeader('FYJC (11th) Details', 1);
        addLine('College', enq.fyjcDetails.college, 1);
        addLine('Board', enq.fyjcDetails.board, 1);
        addLine('Stream', enq.fyjcDetails.stream, 1);
        addLine('Result', enq.fyjcDetails.result, 1);
        addLine('Percentage', enq.fyjcDetails.percentage, 1);
        addLine('Year', enq.fyjcDetails.year, 1);
        addLine('FYJC College Address', enq.fyCollegeAddress, 1);
    }
    
    if(enq.fyDetails) {
        addHeader('FY Degree Details', 1);
        addLine('College', enq.fyDetails.college, 1);
        addLine('University', enq.fyDetails.university, 1);
        addLine('Result', enq.fyDetails.result, 1);
        addLine('Sem 1', `${enq.fyDetails.sem1?.value || 'N/A'} ${enq.fyDetails.sem1?.type || ''}`, 1);
        addLine('Sem 2', `${enq.fyDetails.sem2?.value || 'N/A'} ${enq.fyDetails.sem2?.type || ''}`, 1);
        addLine('Year', enq.fyDetails.year, 1);
    }
    
    if(enq.syDetails) {
        addHeader('SY Degree Details', 1);
        addLine('College', enq.syDetails.college, 1);
        addLine('University', enq.syDetails.university, 1);
        addLine('Result', enq.syDetails.result, 1);
        addLine('Sem 3', `${enq.syDetails.sem3?.value || 'N/A'} ${enq.syDetails.sem3?.type || ''}`, 1);
        addLine('Sem 4', `${enq.syDetails.sem4?.value || 'N/A'} ${enq.syDetails.sem4?.type || ''}`, 1);
        addLine('Year', enq.syDetails.year, 1);
    }

    // Existing/Residential Address (Moved to match form order)
    if(enq.formType === 'First Year Degree') {
        addLine('HSC College Address', enq.existingAddress);
    } else if (enq.formType === 'Second Year Degree') {
         addLine('FY College Address', enq.existingAddress);
    } else if (enq.formType === 'Third Year Degree') {
         addLine('SY College Address', enq.existingAddress);
    }
    
    addHeader('Address');
    addLine('Address Line', enq.residentialAddress?.line);
    addLine('City', enq.residentialAddress?.city);
    addLine('State', enq.residentialAddress?.state);
    addLine('Pincode', enq.residentialAddress?.pincode);
    addLine('Landmark', enq.residentialAddress?.landmark);
    
    addHeader('Declarations');
    addLine('Agreed to Terms', enq.declaration); // Pass boolean
    addLine('Agreed (Non-MH Board)', enq.agreedToEligibility); // Pass boolean
    addLine('Agreed (Other Uni)', enq.agreedToOtherUniversity); // Pass boolean
    addLine('Agreed (SY Other Uni)', enq.agreedToSYOtherUniversity); // Pass boolean
    addLine('Agreed (Stream Mismatch)', enq.agreedToStreamMismatch); // Pass boolean

    doc.save(`${enq.tokenization || enq.studentName || 'enquiry'}.pdf`);
}

function handleExcelDownload() {
    if (!window.XLSX) {
        alert('Excel library not loaded.');
        return;
    }
    if (G.allEnquiries.length === 0) {
        alert('No data to download.');
        return;
    }

    const dataToExport = G.allEnquiries.map(enq => {
        const get = (obj) => obj || {};
        const getSem = (sem) => ({ value: get(sem).value, type: get(sem).type });
        
        return {
            'Token ID': enq.tokenization,
            'Form Type': enq.formType,
            'Section': enq.formSection,
            'Submission Date': enq.submittedAt ? new Date(enq.submittedAt.seconds * 1000).toLocaleString() : 'N/A',
            'Admission Status': enq.admissionStatus || 'Pending', // <-- NEW
            'Admission Form No': enq.admissionFormNo || '', // <-- NEW
            
            'Student Name': enq.studentName,
            'Student Mobile': get(enq.studentMobile).number,
            'Student WhatsApp': get(enq.studentMobile).isWhatsapp ? 'Yes' : 'No',
            'DOB': enq.dob,
            'Aadhar': enq.aadhar,
            
            'Father Name': get(enq.parentInfo).father?.name,
            'Father Mobile': get(enq.parentInfo).father?.mobile?.number,
            'Father Occupation': get(enq.parentInfo).father?.occupation,
            'Mother Name': get(enq.parentInfo).mother?.name,
            'Mother Mobile': get(enq.parentInfo).mother?.mobile?.number,
            'Mother Occupation': get(enq.parentInfo).mother?.occupation,
            
            'Address': get(enq.residentialAddress).line,
            'City': get(enq.residentialAddress).city,
            'State': get(enq.residentialAddress).state,
            'Pincode': get(enq.residentialAddress).pincode,
            'Landmark': get(enq.residentialAddress).landmark,
            
            'Course/Stream': enq.course || enq.preferredStream || '',
            'Referred By': enq.referredBy || '',
            
            'School: Studying': enq.nowStudying,
            'School: Admission To': enq.admissionTo, // ***FIX 1 (in Excel): Added field***
            'School: Last %': enq.lyPercentage,
            'School: Last Result': enq.lyResult,
            'School: Board': enq.board,
            'School: Prev School': enq.prevSchool,
            'School: Address': enq.schoolAddress,
            'School: BC No': enq.bc,
            'School: Student ID': enq.studentId,

            'SSC School': get(enq.sscDetails).school,
            'SSC Board': get(enq.sscDetails).board,
            'SSC Seat No': get(enq.sscDetails).seatNumber,
            'SSC Result': get(enq.sscDetails).result,
            'SSC %': get(enq.sscDetails).percentage,
            'SSC Year': get(enq.sscDetails).year,
            'FYJC School Address': enq.schoolAddress,
            
            'HSC College': get(enq.hscDetails).school,
            'HSC Board': get(enq.hscDetails).board,
            'HSC Seat No': get(enq.hscDetails).seatNumber, // <-- ADDED
            'HSC Stream': get(enq.hscDetails).stream,
            'HSC Result': get(enq.hscDetails).result,
            'HSC %': get(enq.hscDetails).percentage,
            'HSC Year': get(enq.hscDetails).year,
            'FYDegree HSC College Address': enq.existingAddress,

            'FYJC College': get(enq.fyjcDetails).college,
            'FYJC Board': get(enq.fyjcDetails).board,
            'FYJC Stream': get(enq.fyjcDetails).stream,
            'FYJC Result': get(enq.fyjcDetails).result,
            'FYJC %': get(enq.fyjcDetails).percentage,
            'FYJC Year': get(enq.fyjcDetails).year,
            'SYJC FY College Address': enq.fyCollegeAddress,

            'FY Degree College': get(enq.fyDetails).college,
            'FY Degree Uni': get(enq.fyDetails).university,
            'FY Degree Result': get(enq.fyDetails).result,
            'FY Degree Year': get(enq.fyDetails).year,
            'FY Sem 1': `${getSem(enq.fyDetails?.sem1).value || ''} ${getSem(enq.fyDetails?.sem1).type || ''}`.trim(),
            'FY Sem 2': `${getSem(enq.fyDetails?.sem2).value || ''} ${getSem(enq.fyDetails?.sem2).type || ''}`.trim(),
            'SYDegree FY College Address': enq.existingAddress,

            'SY Degree College': get(enq.syDetails).college,
            'SY Degree Uni': get(enq.syDetails).university,
            'SY Degree Result': get(enq.syDetails).result,
            'SY Degree Year': get(enq.syDetails).year,
            'SY Sem 3': `${getSem(enq.syDetails?.sem3).value || ''} ${getSem(enq.syDetails?.sem3).type || ''}`.trim(),
            'SY Sem 4': `${getSem(enq.syDetails?.sem4).value || ''} ${getSem(enq.syDetails?.sem4).type || ''}`.trim(),
            'TYDegree SY College Address': enq.existingAddress,

            'Agreed Terms': enq.declaration ? 'Yes' : 'No',
            'Agreed (Non-MH Board)': enq.agreedToEligibility ? 'Yes' : 'No',
            'Agreed (Other Uni)': enq.agreedToOtherUniversity ? 'Yes' : 'No',
            'Agreed (SY Other Uni)': enq.agreedToSYOtherUniversity ? 'Yes' : 'No',
            'Agreed (Stream Mismatch)': enq.agreedToStreamMismatch ? 'Yes' : 'No',
        };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Enquiries');
    XLSX.writeFile(wb, `SKC_Enquiries_ALL_${new Date().toISOString().split('T')[0]}.xlsx`);
}


// --- Event Handlers ---

async function handleLogin(e) {
  e.preventDefault();
  E.loginForm.error.classList.add('hidden');
  E.loginForm.submitBtn.disabled = true;
  E.loginForm.submitBtn.textContent = 'Logging In...';
  
  const email = E.loginForm.email.value;
  const password = E.loginForm.pass.value;
  
  try {
    await signInWithEmailAndPassword(G.auth, email, password);
  } catch (err) {
    console.error("Admin Login Error: ", err);
    let msg = "Login Failed. Please check your credentials.";
    if (err.code === 'auth/operation-not-allowed') {
       msg = "Login Failed. The 'Email/Password' sign-in method is not enabled in your Firebase project.";
    } else if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
       msg = "Login Failed. User not found or incorrect password.";
    }
    E.loginForm.error.textContent = msg;
    E.loginForm.error.classList.remove('hidden');
    E.loginForm.submitBtn.disabled = false;
    E.loginForm.submitBtn.textContent = 'Login';
  }
}

async function handleSaveEnquiry(e, formType, docId = null) {
  e.preventDefault();
  const form = e.target;
  
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  const submitBtn = form.querySelector('.submit-form-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = docId ? 'Saving...' : 'Submitting...';
  
  const formData = getFormData(form);
  const formSection = getFormSection(formType);
  
  try {
    const collectionPath = `artifacts/${appId}/public/data/enquiries`;
    const allNumbers = [
        formData.studentMobile?.number,
        formData.parentInfo?.father?.mobile?.number,
        formData.parentInfo?.mother?.mobile?.number
    ].filter(Boolean);

    // --- PRECISE DUPLICATION CHECKS (Handles Edits) ---
    
    // 1. Aadhar
    if (formData.aadhar) {
        const qAadhar = query(collection(G.db, collectionPath), 
                              where("aadhar", "==", formData.aadhar),
                              where("formType", "==", formType)); 
        const aadharSnapshot = await getDocs(qAadhar);
        const aadharDuplicates = aadharSnapshot.docs.filter(doc => doc.id !== docId);
        if (aadharDuplicates.length > 0) {
          throw new Error(`An enquiry with this Aadhar number (${formData.aadhar}) has already been submitted for ${formType}.`);
        }
    }
    
    // 2. Student Name
    const normalizedName = (formData.studentName || '').trim().toLowerCase();
    if (normalizedName) {
      const qName = query(collection(G.db, collectionPath), 
                          where("studentNameLower", "==", normalizedName),
                          where("formType", "==", formType)); 
      const nameSnapshot = await getDocs(qName);
      const nameDuplicates = nameSnapshot.docs.filter(doc => doc.id !== docId);
      if (nameDuplicates.length > 0) {
        throw new Error(`An enquiry with this student name (${formData.studentName}) has already been submitted for ${formType}.`);
      }
    }
    
    // 3. Student Mobile
    if (formData.studentMobile?.number) {
        const qMobile = query(collection(G.db, collectionPath), 
                                where("studentMobile.number", "==", formData.studentMobile.number),
                                where("formType", "==", formType)); 
        const mobileSnapshot = await getDocs(qMobile);
        const mobileDuplicates = mobileSnapshot.docs.filter(doc => doc.id !== docId);
        if (mobileDuplicates.length > 0) {
            throw new Error(`An enquiry with this Student Mobile Number (${formData.studentMobile.number}) has already been submitted for ${formType}.`);
        }
    }
    
    // --- All checks passed, submit ---
    
    const dataToSave = {
      ...formData,
      formType: formType,
      formSection: formSection, 
      studentNameLower: normalizedName,
      allMobileNumbers: allNumbers, 
    };

    if (docId) {
        // UPDATE existing document
        const docRef = doc(G.db, collectionPath, docId);
        await updateDoc(docRef, {
            ...dataToSave,
            lastEditedAt: serverTimestamp() 
        });
        hideModal();
        showModal('Success', 'Enquiry has been updated successfully.', 'info');
    } else {
        // ADD new document
        const token = await generateNewToken(formType);
        dataToSave.tokenization = token;
        dataToSave.submittedAt = serverTimestamp();
        dataToSave.admissionStatus = 'Pending'; // <-- NEW: Default status
        
        await addDoc(collection(G.db, collectionPath), dataToSave);
        
        E.successPage.token.textContent = token;
        showView('success');
    }
    
  } catch (err) {
    console.error("Submission/Update Error: ", err);
    showModal('Error', err.message, 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = docId ? 'Save Changes' : 'Submit Enquiry';
  }
}

/**
 * NEW: Handles changing the admission status from the admin table dropdown.
 */
async function handleStatusChange(e) {
    const select = e.target;
    if (!select.classList.contains('admin-status-select')) return;

    const docId = select.dataset.id;
    const newStatus = select.value;
    if (!docId || !newStatus) return;

    select.disabled = true; // Show loading state
    
    try {
        const collectionPath = `artifacts/${appId}/public/data/enquiries`;
        const docRef = doc(G.db, collectionPath, docId);
        await updateDoc(docRef, {
            admissionStatus: newStatus,
            lastEditedAt: serverTimestamp()
        });
        // Success! The onSnapshot listener will handle the UI update.
    } catch (err) {
        console.error("Error updating status: ", err);
        showModal('Error', `Failed to update status: ${err.message}`, 'error');
        // Revert on error (onSnapshot will correct this anyway, but this is faster)
        const originalEnquiry = G.allEnquiries.find(enq => enq.id === docId);
        select.value = originalEnquiry.admissionStatus || 'Pending';
    } finally {
        select.disabled = false; // Re-enable
    }
}

/**
 * NEW: Handles saving the Admission Form No. from the admin table input.
 */
async function handleFormNoChange(e) {
    const input = e.target;
    if (!input.classList.contains('admin-form-no-input')) return;

    const docId = input.dataset.id;
    const newFormNo = input.value.trim();
    if (!docId) return;

    // Compare with old value to prevent unnecessary writes
    const originalEnquiry = G.allEnquiries.find(enq => enq.id === docId);
    const oldFormNo = originalEnquiry.admissionFormNo || '';
    if (newFormNo === oldFormNo) return; // No change

    input.disabled = true; // Show loading state
    input.classList.add('bg-gray-100');
    
    try {
        const collectionPath = `artifacts/${appId}/public/data/enquiries`;
        const docRef = doc(G.db, collectionPath, docId);
        await updateDoc(docRef, {
            admissionFormNo: newFormNo,
            lastEditedAt: serverTimestamp()
        });
        // Success! The onSnapshot listener will handle the UI update.
    } catch (err) {
        console.error("Error updating form no: ", err);
        showModal('Error', `Failed to update form no: ${err.message}`, 'error');
        // Revert on error
        input.value = oldFormNo;
    } finally {
        input.disabled = false; // Re-enable
        input.classList.remove('bg-gray-100');
    }
}

/**
 * Attaches all conditional logic, validation, and submit listeners to a form.
 */
function addFormListeners(formId, formType, docId = null, isViewOnly = false) {
  const container = (formId === 'modal-body') ? E.modal.body : document.getElementById(formId);
  if (!container) return;
  
  const form = container.querySelector('form');
  if (!form) return;
  
  if (!isViewOnly) {
    // Only add submit listener if it's an editable form (public or edit modal)
    form.addEventListener('submit', (e) => handleSaveEnquiry(e, formType, docId)); // Pass docId
  }
  
  // --- Input validation listeners ---
  form.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', (e) => {
      if (e.target.dataset.isName) {
        e.target.value = e.target.value.replace(/[^A-Za-z\s.]/g, '');
      }
      if (e.target.dataset.isNumeric) {
         e.target.value = e.target.value.replace(/[^0-9]/g, '');
      }
      if (e.target.type === 'tel' && e.target.maxLength === 10) {
         e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
      }
      
      // ***FIX 3: Year field validation***
      if(e.target.id.includes('Year') && e.target.maxLength === 4) {
         const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4); 
         if(val.length === 4) {
            const year = parseInt(val, 10);
            if (year < 1947 || year > 2030) {
              e.target.setCustomValidity('Year must be between 1947 and 2030.');
            } else {
              e.target.setCustomValidity('');
            }
         } else if (e.target.required && val.length < 4) {
             e.target.setCustomValidity('Please enter a 4-digit year.');
         } else {
             e.target.setCustomValidity('');
         }
         e.target.value = val;
      }
      
      // Percentage validation (allows decimals)
      if(e.target.id.includes('Percentage')) {
         if (parseFloat(e.target.value) > 99.99) e.target.value = 99.99;
         if (e.target.value.length > 0 && parseFloat(e.target.value) < 0) e.target.value = '0.00';
      }
      // CGPI validation (allows decimals)
      if(e.target.id.includes('Cgpi')) {
         if (parseFloat(e.target.value) > 10.00) e.target.value = 10.00;
         if (e.target.value.length > 0 && parseFloat(e.target.value) < 0) e.target.value = '0.00';
      }
    });
  });
  
  // --- Conditional Logic ---
  
  if (formType === 'School') {
    const dobInput = form.querySelector('#dob');
    const ageInput = form.querySelector('#calculatedAge');
    if (dobInput && ageInput) {
        dobInput.addEventListener('input', (e) => {
            ageInput.value = calculateAge(e.target.value);
        });
        // Set initial value (handles edit/view population)
        ageInput.value = calculateAge(dobInput.value);
    }
    
    const nowStudying = form.querySelector('#nowStudying');
    const conditionalFields = form.querySelector('#school-conditional-fields');
    const fresherAadhar = form.querySelector('#school-fresher-aadhar');
    
    if (nowStudying && conditionalFields && fresherAadhar) {
      const fresherAadharInput = fresherAadhar.querySelector('input');
      const conditionalAadharInput = conditionalFields.querySelector('#aadhar');
    
      const toggleSchoolFields = () => {
        const isFresher = nowStudying.value === 'Fresher';
        conditionalFields.classList.toggle('hidden', isFresher);
        fresherAadhar.classList.toggle('hidden', !isFresher);
        
        // Set required status only if NOT view-only
        if (!isViewOnly) {
          conditionalFields.querySelectorAll('input, select').forEach(el => {
            // Aadhar is required, but handled separately
            if (el.id !== 'aadhar' && el.id !== 'bc' && el.id !== 'studentId') el.required = !isFresher;
          });
          conditionalAadharInput.required = !isFresher;
          fresherAadharInput.required = isFresher;
        }

        // Clear the *other* aadhar field when toggling on a NEW form
        if (docId == null) { 
          if (isFresher) {
            conditionalAadharInput.value = '';
          } else {
            fresherAadharInput.value = '';
          }
        }
      };
      
      nowStudying.addEventListener('change', toggleSchoolFields);
      toggleSchoolFields(); // Run on init
    }
  }
  
  const setupSemesterLogic = (sem1, sem2) => {
    const sem1Perc = form.querySelector(`#${sem1}Percentage`);
    const sem1Cgpi = form.querySelector(`#${sem1}Cgpi`);
    const sem2Perc = form.querySelector(`#${sem2}Percentage`);
    const sem2Cgpi = form.querySelector(`#${sem2}Cgpi`);

    if (!sem1Perc) return; 

    const toggleSem = (typeRadioName, percInput, cgpiInput) => {
        const type = form.querySelector(`input[name="${typeRadioName}"]:checked`)?.value;
        
        if (type === 'Percentage') {
            if (cgpiInput) cgpiInput.disabled = true;
            if (percInput) {
                percInput.disabled = false;
                if (!isViewOnly) percInput.required = true;
            }
        } else if (type === 'CGPI') {
            if (percInput) percInput.disabled = true;
            if (cgpiInput) {
                cgpiInput.disabled = false;
                if (!isViewOnly) cgpiInput.required = true;
            }
        } else if (!docId && !isViewOnly) { // Only default check on NEW forms
            const el = form.querySelector(`input[name="${typeRadioName}"][value="Percentage"]`);
            if (el) el.checked = true;
            if (cgpiInput) cgpiInput.disabled = true;
            if (percInput) {
                percInput.disabled = false;
                percInput.required = true;
            }
        }
    };
    
    // Run toggle on init for both semesters (handles edit/view)
    toggleSem(`${sem1}Type`, sem1Perc, sem1Cgpi);
    toggleSem(`${sem2}Type`, sem2Perc, sem2Cgpi);

    // Add change listeners only if not view-only
    if (!isViewOnly) {
        form.querySelectorAll(`input[name="${sem1}Type"]`).forEach(radio => {
          radio.addEventListener('change', (e) => {
            const isPerc = e.target.value === 'Percentage';
            sem1Perc.disabled = !isPerc;
            sem1Perc.required = isPerc;
            sem1Cgpi.disabled = isPerc;
            sem1Cgpi.required = !isPerc;
            if (isPerc) sem1Cgpi.value = ''; else sem1Perc.value = '';
          });
        });
        form.querySelectorAll(`input[name="${sem2}Type"]`).forEach(radio => {
          radio.addEventListener('change', (e) => {
            const isPerc = e.target.value === 'Percentage';
            sem2Perc.disabled = !isPerc;
            sem2Perc.required = isPerc;
            sem2Cgpi.disabled = isPerc;
            sem2Cgpi.required = !isPerc;
            if (isPerc) sem2Cgpi.value = ''; else sem2Perc.value = '';
          });
        });
    }
  };
  
  // Apply semester logic to the correct forms
  if (formType === 'Second Year Degree' || formType === 'Third Year Degree') {
    setupSemesterLogic('sem1', 'sem2');
  }
  if (formType === 'Third Year Degree') {
    setupSemesterLogic('sem3', 'sem4');
  }
  
  // --- Add agreement listeners ---
  addEligibilityListeners(form, formType, docId, isViewOnly);
  addOtherUniversityListener(form, formType, docId, isViewOnly);
  addStreamMismatchListener(form, formType, docId, isViewOnly);
  
  // Manually trigger change events for conditional logic on edit/view forms
  // This ensures the correct fields are shown/hidden when the form loads
  if (docId) {
      form.querySelector('#nowStudying')?.dispatchEvent(new Event('change'));
      form.querySelector('#sscBoard')?.dispatchEvent(new Event('change'));
      form.querySelector('#hscBoard')?.dispatchEvent(new Event('change'));
      form.querySelector('#fyjcBoard')?.dispatchEvent(new Event('change'));
      form.querySelector('#fyUniversity')?.dispatchEvent(new Event('change'));
      form.querySelector('#syUniversity')?.dispatchEvent(new Event('change'));
      form.querySelector('#fyjcStream')?.dispatchEvent(new Event('change'));
      form.querySelectorAll('input[name="preferredStream"]').forEach(r => {
          if (r.checked) r.dispatchEvent(new Event('change'));
      });
  }
  
  if (isViewOnly) {
      disableFormFields(form);
  }
}

function addEligibilityListeners(form, formType, docId = null, isViewOnly = false) {
  const container = form.querySelector('#eligibility-agreement-container');
  
  const showEligibilityCheckbox = () => {
    if (!container) return; 
    if (container.querySelector('#eligibilityAgreement')) return; // Already exists
    const html = `
      <div class="mt-6 p-4 border border-yellow-300 rounded-lg bg-yellow-50" id="eligibility-checkbox-wrapper">
        <div class="flex items-start">
          <input type="checkbox" id="eligibilityAgreement" name="eligibilityAgreement" required class="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"/>
          <label for="eligibilityAgreement" class="ml-3 block text-sm text-yellow-800">
            <span class="text-red-500 font-bold">*</span> I have read and agree to the <strong>Eligibility Requirement for Non-Maharashtra Board</strong>.
          </label>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
    
    // If it's an edit/view form, populate the checkbox
    if (docId && G.currentEnquiryForModal) {
        form.querySelector('#eligibilityAgreement').checked = !!G.currentEnquiryForModal.agreedToEligibility;
    }
  };
  
  const hideEligibilityCheckbox = () => {
     if (!container) return;
     const wrapper = container.querySelector('#eligibility-checkbox-wrapper');
     if (wrapper) wrapper.remove();
  };
  
  const check = (e, modalTitle, modalContentKey) => {
       if (e.target.value && e.target.value !== 'Maharashtra Board') {
         if (!docId && !isViewOnly) showModal(modalTitle, getEligibilityContent(modalContentKey));
         showEligibilityCheckbox();
       } else {
         hideEligibilityCheckbox();
       }
  };

  if(formType === 'School') {
    const el = form.querySelector('#board');
    el?.addEventListener('change', (e) => check(e, 'Eligibility Requirement (School)', 'School'));
    if (docId && el?.value) el.dispatchEvent(new Event('change')); // FIXED: Trigger on load
  }
  if(formType === 'F.Y.J.C (11th)') {
     const el = form.querySelector('#sscBoard');
     el?.addEventListener('change', (e) => check(e, 'Eligibility Requirement (Junior College)', 'JC'));
     if (docId && el?.value) el.dispatchEvent(new Event('change')); // FIXED: Trigger on load
  }
  if(formType === 'S.Y.J.C (12th)') {
     const sscEl = form.querySelector('#sscBoard');
     const fyjcEl = form.querySelector('#fyjcBoard');
     
     const checkSyjc = () => {
        const sscBoard = sscEl?.value;
        const fyjcBoard = fyjcEl?.value;
        
        if ((sscBoard && sscBoard !== 'Maharashtra Board') || (fyjcBoard && fyjcBoard !== 'Maharashtra Board')) {
          if (!docId && !isViewOnly) showModal('Eligibility Requirement (SYJC)', getEligibilityContent('SYJC'));
          showEligibilityCheckbox();
        } else {
          hideEligibilityCheckbox();
        }
     };
     
     sscEl?.addEventListener('change', checkSyjc);
     fyjcEl?.addEventListener('change', checkSyjc);
     if (docId && (sscEl?.value || fyjcEl?.value)) checkSyjc(); // FIXED: Trigger on load
  }
  if(formType === 'First Year Degree' || formType === 'Second Year Degree' || formType === 'Third Year Degree') {
     const el = form.querySelector('#hscBoard');
     el?.addEventListener('change', (e) => check(e, 'Eligibility Requirement (Degree College)', 'Degree'));
     if (docId && el?.value) el.dispatchEvent(new Event('change')); // FIXED: Trigger on load
  }
}

function addOtherUniversityListener(form, formType, docId = null, isViewOnly = false) {
    
    const setupListener = (uniSelectId, containerId, agreementId, agreementName) => {
        const universitySelect = form.querySelector(`#${uniSelectId}`);
        const container = form.querySelector(`#${containerId}`);
        
        if (!universitySelect || !container) return;
        
        const checkUni = () => {
            const wrapper = container.querySelector(`#${agreementId}-wrapper`);
            if (universitySelect.value && universitySelect.value !== 'Mumbai University') {
                if (!docId && !isViewOnly) showModal('University Transfer Requirement', getEligibilityContent('OtherUniversity'));
                if (!wrapper) { 
                    const html = `
                      <div class="mt-6 p-4 border border-yellow-300 rounded-lg bg-yellow-50" id="${agreementId}-wrapper">
                        <div class="flex items-start">
                          <input type="checkbox" id="${agreementId}" name="${agreementName}" required class="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"/>
                          <label for="${agreementId}" class="ml-3 block text-sm text-yellow-800">
                            <span class="text-red-500 font-bold">*</span> I declare that I have spoken to <strong>Dr. Adil Shaikh - Principal</strong> regarding the norms for transferring from another university and agree to complete all required procedures.
                          </label>
                        </div>
                      </div>
                    `;
                    container.innerHTML = html;
                    
                    // Populate checkbox if edit/view
                    if (docId && G.currentEnquiryForModal) {
                       const key = (agreementId === 'otherSYUniversityAgreement') ? 'agreedToSYOtherUniversity' : 'agreedToOtherUniversity';
                       form.querySelector(`#${agreementId}`).checked = !!G.currentEnquiryForModal[key];
                    }
                }
            } else {
                if (wrapper) wrapper.remove(); 
            }
        };

        universitySelect.addEventListener('change', checkUni);
        if (docId && universitySelect.value) checkUni(); // FIXED: Trigger on load
    };
    
    if (formType === 'Second Year Degree' || formType === 'Third Year Degree') {
         setupListener('fyUniversity', 'other-university-agreement-container', 'otherUniversityAgreement', 'otherUniversityAgreement');
    }
    
    if (formType === 'Third Year Degree') {
         setupListener('syUniversity', 'other-sy-university-agreement-container', 'otherSYUniversityAgreement', 'otherSYUniversityAgreement');
    }
}

function addStreamMismatchListener(form, formType, docId = null, isViewOnly = false) {
    if (formType !== 'S.Y.J.C (12th)') {
        return;
    }

    const preferredStreamRadios = form.querySelectorAll('input[name="preferredStream"]');
    const fyjcStreamSelect = form.querySelector('#fyjcStream');
    const container = form.querySelector('#stream-mismatch-agreement-container');

    if (!preferredStreamRadios.length || !fyjcStreamSelect || !container) return;

    const checkStreams = () => {
        const preferredStreamEl = form.querySelector('input[name="preferredStream"]:checked');
        const preferredValue = preferredStreamEl ? preferredStreamEl.value : null;
        const fyjcValue = fyjcStreamSelect.value;
        const wrapper = container.querySelector('#stream-mismatch-checkbox-wrapper');

        if (preferredValue && fyjcValue && preferredValue !== fyjcValue) {
            if (!docId && !isViewOnly) showModal('Stream Mismatch Warning', 'Your preferred 12th stream is different from your 11th stream. Please contact the Admin office.');
            if (!wrapper) {
                const html = `
                  <div class="mt-6 p-4 border border-yellow-300 rounded-lg bg-yellow-50" id="stream-mismatch-checkbox-wrapper">
                    <div class="flex items-start">
                      <input type="checkbox" id="streamMismatchAgreement" name="streamMismatchAgreement" required class="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"/>
                      <label for="streamMismatchAgreement" class="ml-3 block text-sm text-yellow-800">
                        <span class="text-red-500 font-bold">*</span> I have read and accept that all things and aggred as told admin office.
                      </label>
                    </div>
                  </div>
                `;
                container.innerHTML = html;
                
                // Populate checkbox if edit/view
                if (docId && G.currentEnquiryForModal) {
                    form.querySelector('#streamMismatchAgreement').checked = !!G.currentEnquiryForModal.agreedToStreamMismatch;
                }
            }
        } else {
            if (wrapper) wrapper.remove();
        }
    };

    preferredStreamRadios.forEach(radio => radio.addEventListener('change', checkStreams));
    fyjcStreamSelect.addEventListener('change', checkStreams);
    
    if (docId && fyjcStreamSelect.value) checkStreams(); // FIXED: Trigger on load
}

/**
 * Helper to disable all fields in a form for "View" mode
 */
function disableFormFields(form) {
    form.querySelectorAll('input, select, textarea').forEach(el => {
        el.disabled = true;
        if (el.type !== 'checkbox' && el.type !== 'radio') {
            el.classList.add('bg-gray-100', 'text-gray-700');
        }
    });
    // Hide agreement containers IF they are empty (i.e., no checkbox was added)
    // This check happens *after* the listeners have run and potentially added them
    form.querySelectorAll('[id$="-agreement-container"]').forEach(container => {
        if (container.innerHTML.trim() === '') {
            container.classList.add('hidden');
        }
    });
    // Hide submit button if it exists (e.g., in a public form)
    const submitBtn = form.querySelector('.submit-form-btn');
    if (submitBtn) submitBtn.classList.add('hidden');
}

function getEligibilityContent(type) {
  const contactSchool = `<p class="font-bold mt-4">For more doubts, please contact:</p><p class="text-blue-700 font-semibold">Urmila Raut Miss - Campus Head</p>`;
  const contactDegree = `<p class="font-bold mt-4">For more doubts, please contact:</p><p class="text-blue-700 font-semibold">Dr. Adil Shaikh - Principal</p>`;
  
  const content = {
    'OtherUniversity': `
      <p class="font-semibold text-base text-gray-800">You have selected a university other than Mumbai University.</p>
      <p class="mt-2">Please meet <strong>Dr. Adil Shaikh - Principal</strong> immediately to discuss the eligibility norms and procedures for transfer students.</p>
      <p class="font-semibold text-red-600 bg-red-50 p-2 rounded-md mt-3">Your enquiry is provisional until this meeting is complete.</p>
    `
  };
  
  content['School'] = `<p class="font-bold">Documents Required for Eligibility (Mandatory):</p><ul class="list-disc list-inside space-y-1 pl-2"><li>Leaving Certificate / Transfer Certificate with counter sign</li><li>Migration Certificate - Original</li><li>Aadhar Card Copy</li><li>Passport Size Photographs</li></ul><p class="font-semibold text-red-600 bg-red-50 p-2 rounded-md">Note: The Fees will be different for this process.</p>${contactSchool}`;
  content['JC'] = `<p class="font-bold">Documents Required for Eligibility (Mandatory):</p><ul class="list-disc list-inside space-y-1 pl-2"><li>Original Marksheet (10th/SSC)</li><li>Original Passing Certificate (Optional)</li><li>Leaving Certificate / Transfer Certificate with counter sign</li><li>Migration Certificate - Original</li><li>Aadhar Card Copy</li><li>Passport Size Photographs</li></ul><p class="font-semibold text-red-600 bg-red-50 p-2 rounded-md">Note: The Processing Fees will be different for this.</p>${contactSchool}`;
  content['SYJC'] = `<p class="font-bold">Documents Required for Eligibility (Mandatory):</p><ul class="list-disc list-inside space-y-1 pl-2"><li>Original Marksheet (10th/SSC)</li><li>Original Passing Certificate</li><li>FYJC Result</li><li>Leaving Certificate / Transfer Certificate with counter sign</li><li>Migration Certificate - Original</li><li>Aadhar Card Copy</li><li>Passport Size Photographs</li></ul><p class="font-semibold text-red-600 bg-red-50 p-2 rounded-md">Note: The Processing Fees will be different for this.</p>${contactSchool}`;
  content['Degree'] = `<p class="font-bold">Documents Required for Eligibility (Mandatory):</p><ul class="list-disc list-inside space-y-1 pl-2"><li>Original Marksheet (10th/SSC)</li><li>Original Passing Certificate (10th/SSC)</li><li>Original Marksheet (12th/HSC)</li><li>Original Passing Certificate (12th/HSC)</li><li>Leaving Certificate / Transfer Certificate with counter sign</li><li>Migration Certificate - Original</li><li>Aadhar Card Copy</li><li>Passport Size Photographs</li></ul><p class="font-semibold text-red-600 bg-red-50 p-2 rounded-md">Note: The Fees will be different for this process.</p>${contactDegree}`;
  
  const defaultContent = `
    <div class="space-y-3 text-sm text-gray-700">
      <p class="font-semibold text-base text-gray-800">For students from boards other than Maharashtra Board, the following eligibility process is mandatory.</p>
      ${content[type] || content['JC']}
    </div>
  `;
  
  return type === 'OtherUniversity' ? content[type] : defaultContent;
}

// --- Modal Functions (View, Edit, Download) ---

/**
 * Opens the View Modal (Read-Only Form)
 */
async function openViewModal(docId, formType) {
  E.modal.title.textContent = `View Enquiry (Loading...)`;
  E.modal.body.innerHTML = '<div class="spinner mx-auto"></div>';
  showModal(E.modal.title.textContent, E.modal.body.innerHTML, 'view'); // 'view' type

  try {
    const enq = await fetchEnquiry(docId);
    G.currentEnquiryForModal = enq; // Store for agreement logic
    
    E.modal.title.textContent = `View: ${enq.studentName || 'Enquiry'}`;
    
    // 1. Get the correct form HTML
    const formHTML = getFormHTML(formType);
    
    // 2. Render the form shell
    E.modal.body.innerHTML = `
      <form id="view-form">
        <h2 class="text-2xl font-bold text-center text-blue-800 mb-6">${formType}</h2>
        ${formHTML}
        <div class="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">Declaration</h3>
          <div class="flex items-start">
            <input type="checkbox" id="declaration" name="declaration" required class="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"/>
            <label for="declaration" class="ml-3 block text-sm text-gray-700">
              I hereby declare that all the information provided is true and correct...
            </label>
          </div>
        </div>
        <!-- No submit button -->
      </form>
    `;
    
    // 3. Populate the form
    const form = E.modal.body.querySelector('#view-form');
    populateForm(form, enq);
    
    // 4. Add listeners (for conditional logic) AND disable all fields
    addFormListeners('modal-body', formType, docId, true); // true = isViewOnly

  } catch (err) {
    console.error("Error opening view modal: ", err);
    showModal('Error', `Failed to load enquiry: ${err.message}`, 'error');
  }
}


/**
 * Opens the Edit Modal (Editable Form)
 */
async function openEditModal(docId, formType) {
  E.modal.title.textContent = `Edit Enquiry (Loading...)`;
  E.modal.body.innerHTML = '<div class="spinner mx-auto"></div>';
  showModal(E.modal.title.textContent, E.modal.body.innerHTML, 'edit'); // 'edit' type

  try {
    const enq = await fetchEnquiry(docId);
    G.currentEnquiryForModal = enq; // Store for agreement logic
    
    E.modal.title.textContent = `Edit: ${enq.studentName || 'Enquiry'}`;
    
    // 1. Get the correct form HTML
    const formHTML = getFormHTML(formType);
    
    // 2. Render the form inside the modal
    E.modal.body.innerHTML = `
      <form id="edit-form" data-doc-id="${docId}" data-form-type="${formType}">
        <h2 class="text-2xl font-bold text-center text-blue-800 mb-6">${formType}</h2>
        ${formHTML}
        <div class="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">Declaration</h3>
          <div class="flex items-start">
            <input type="checkbox" id="declaration" name="declaration" required class="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"/>
            <label for="declaration" class="ml-3 block text-sm text-gray-700">
              I hereby declare that all the information provided is true and correct...
            </label>
          </div>
        </div>
        <button type="submit" class="submit-form-btn w-full mt-6 text-white font-bold py-3 px-4 rounded-lg bg-green-600 hover:bg-green-700 shadow-md">
          Save Changes
        </button>
      </form>
    `;
    
    // 3. Populate the form with data
    const form = E.modal.body.querySelector('#edit-form');
    populateForm(form, enq);
    
    // 4. Add all listeners (validation, conditional logic)
    addFormListeners('modal-body', formType, docId, false); // false = NOT view only

  } catch (err) {
    console.error("Error opening edit modal: ", err);
    showModal('Error', `Failed to load enquiry: ${err.message}`, 'error');
  }
}

/**
 * Opens the Download Preview Modal (Clean List)
 */
function openDownloadModal(enq) {
  if (!enq) return;
  G.currentEnquiryForModal = enq; // Store for the download button
  const title = `Download Preview: ${enq.studentName}`;
  const content = renderAdminDetails(enq); // The clean list
  showModal(title, content, 'download'); // 'download' type
}

/**
 * Fetches a single enquiry by ID.
 */
async function fetchEnquiry(docId) {
    const collectionPath = `artifacts/${appId}/public/data/enquiries`;
    const docRef = doc(G.db, collectionPath, docId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error("Document not found.");
    }
    return docSnap.data();
}

/**
 * Gets the correct form HTML string by type.
 */
function getFormHTML(formType) {
    if (formType === 'School') return getSchoolForm();
    if (formType === 'F.Y.J.C (11th)') return getFyjcForm();
    if (formType === 'S.Y.J.C (12th)') return getSyjcForm();
    if (formType === 'First Year Degree') return getFyDegreeForm();
    if (formType === 'Second Year Degree') return getSyDegreeForm();
    if (formType === 'Third Year Degree') return getTyDegreeForm();
    return '<p class="text-red-500">Error: Form type not recognized.</p>';
}

/**
 * Populates a form with existing enquiry data
 */
function populateForm(form, enq) {
    if (!form || !enq) return;

    const setVal = (id, value) => {
        const el = form.querySelector(`#${id}`);
        if (el) el.value = value || '';
    };
    const setRadio = (name, value) => {
        const el = form.querySelector(`input[name="${name}"][value="${value}"]`);
        if (el) el.checked = true;
    };
    const setCheck = (id, value) => {
        const el = form.querySelector(`#${id}`);
        if (el) el.checked = !!value;
    };
    const setMobile = (id, mobileData) => {
        setVal(id, mobileData?.number);
        setCheck(`${id}-whatsapp`, mobileData?.isWhatsapp);
    };
    
    try {
        // --- Standard Fields (All Forms) ---
        setVal('studentName', enq.studentName);
        setMobile('studentMobile', enq.studentMobile);
        setVal('dob', enq.dob);
        setVal('aadhar', enq.aadhar); 
        setVal('aadhar_fresher', enq.aadhar); // Populate both, conditional logic will hide one

        // Parent Info
        setVal('fatherName', enq.parentInfo?.father?.name);
        setVal('fatherOccupation', enq.parentInfo?.father?.occupation);
        setMobile('fatherMobile', enq.parentInfo?.father?.mobile);
        setVal('motherName', enq.parentInfo?.mother?.name);
        setVal('motherOccupation', enq.parentInfo?.mother?.occupation);
        setMobile('motherMobile', enq.parentInfo?.mother?.mobile);

        // Address
        setVal('residentialAddressLine', enq.residentialAddress?.line);
        setVal('residentialAddressCity', enq.residentialAddress?.city);
        setVal('residentialAddressState', enq.residentialAddress?.state);
        setVal('residentialAddressPincode', enq.residentialAddress?.pincode);
        setVal('residentialAddressLandmark', enq.residentialAddress?.landmark);
        
        setCheck('declaration', enq.declaration);

        // --- Form Specific Fields ---
        
        // School
        setVal('nowStudying', enq.nowStudying);
        setVal('admissionTo', enq.admissionTo);
        setVal('lyPercentage', enq.lyPercentage);
        setRadio('lyResult', enq.lyResult);
        setVal('board', enq.board);
        setVal('bc', enq.bc);
        setVal('studentId', enq.studentId);
        setVal('prevSchool', enq.prevSchool);
        setVal('schoolAddress', enq.schoolAddress);
        
        // JC (FY & SY)
        setVal('referredBy', enq.referredBy);
        setRadio('preferredStream', enq.preferredStream);
        
        // SSC (in JC & Degree)
        setVal('sscSchool', enq.sscDetails?.school);
        setVal('sscBoard', enq.sscDetails?.board);
        setRadio('sscResult', enq.sscDetails?.result);
        setVal('sscPercentage', enq.sscDetails?.percentage);
        setVal('sscYear', enq.sscDetails?.year);
        setVal('sscSeatNumber', enq.sscDetails?.seatNumber);
        
        // FYJC (in SYJC form)
        setVal('fyjcCollege', enq.fyjcDetails?.college);
        setVal('fyjcBoard', enq.fyjcDetails?.board);
        setVal('fyjcStream', enq.fyjcDetails?.stream);
        setRadio('fyjcResult', enq.fyjcDetails?.result);
        setVal('fyjcPercentage', enq.fyjcDetails?.percentage);
        setVal('fyjcYear', enq.fyjcDetails?.year);
        setVal('fyCollegeAddress', enq.fyCollegeAddress);
        
        // HSC (in Degree forms)
        setVal('hscSchool', enq.hscDetails?.school);
        setVal('hscBoard', enq.hscDetails?.board);
        setVal('hscStream', enq.hscDetails?.stream);
        setRadio('hscResult', enq.hscDetails?.result);
        setVal('hscPercentage', enq.hscDetails?.percentage);
        setVal('hscYear', enq.hscDetails?.year);
        setVal('hscSeatNumber', enq.hscDetails?.seatNumber); // <-- ADDED

        // Degree Course (All Degree)
        setRadio('course', enq.course);
        setVal('existingAddress', enq.existingAddress); 

        // FY Degree Details (in SY & TY forms)
        setVal('fyDegreeCollege', enq.fyDetails?.college);
        setVal('fyUniversity', enq.fyDetails?.university);
        setRadio('fyResult', enq.fyDetails?.result);
        setRadio('sem1Type', enq.fyDetails?.sem1?.type);
        setVal(enq.fyDetails?.sem1?.type === 'Percentage' ? 'sem1Percentage' : 'sem1Cgpi', enq.fyDetails?.sem1?.value);
        setRadio('sem2Type', enq.fyDetails?.sem2?.type);
        setVal(enq.fyDetails?.sem2?.type === 'Percentage' ? 'sem2Percentage' : 'sem2Cgpi', enq.fyDetails?.sem2?.value);
        setVal('fyYear', enq.fyDetails?.year);

        // SY Degree Details (in TY form)
        setVal('syDegreeCollege', enq.syDetails?.college);
        setVal('syUniversity', enq.syDetails?.university);
        setRadio('syResult', enq.syDetails?.result);
        setRadio('sem3Type', enq.syDetails?.sem3?.type);
        setVal(enq.syDetails?.sem3?.type === 'Percentage' ? 'sem3Percentage' : 'sem3Cgpi', enq.syDetails?.sem3?.value);
        setRadio('sem4Type', enq.syDetails?.sem4?.type);
        setVal(enq.syDetails?.sem4?.type === 'Percentage' ? 'sem4Percentage' : 'sem4Cgpi', enq.syDetails?.sem4?.value);
        setVal('syYear', enq.syDetails?.year);
        
        // Agreement checkboxes are populated by their specific listener functions
        
    } catch (err) {
        console.error('Error populating form fields:', err);
    }
}


// --- App Init ---
async function init() {
  E = {
    views: {
      error: document.getElementById('error-view'),
      public: document.getElementById('public-view'),
      login: document.getElementById('admin-login-view'),
      admin: document.getElementById('admin-data-view'),
      adminAnalytics: document.getElementById('admin-analytics-view'), // <-- NEW
      success: document.getElementById('success-page'),
      forms: {
        'school-form-page': document.getElementById('school-form-page'),
        'fyjc-form-page': document.getElementById('fyjc-form-page'),
        'syjc-form-page': document.getElementById('syjc-form-page'),
        'fy-degree-form-page': document.getElementById('fy-degree-form-page'),
        'sy-degree-form-page': document.getElementById('sy-degree-form-page'),
        'ty-degree-form-page': document.getElementById('ty-degree-form-page'),
      }
    },
    nav: {
      loginBtn: document.getElementById('public-admin-login-btn'),
      backBtn: document.getElementById('admin-back-btn'),
      adminSignOutBtn: document.getElementById('admin-signout-btn'),
      logo: document.getElementById('skc-logo-img'), // Get logo
      viewAnalyticsBtn: document.getElementById('view-analytics-btn'), // <-- NEW
      analyticsBackToMainBtn: document.getElementById('analytics-back-to-main-btn') // <-- NEW
    },
    loginForm: {
      form: document.getElementById('admin-login-form'),
      email: document.getElementById('adminUser'),
      pass: document.getElementById('adminPass'),
      error: document.getElementById('admin-login-error'),
      submitBtn: document.getElementById('admin-login-submit-btn'),
    },
    adminView: {
      tableBody: document.getElementById('admin-table-body'),
      searchTerm: document.getElementById('searchTerm'),
      searchField: document.getElementById('searchField'),
      filterByStatus: document.getElementById('filterByStatus'), // <-- NEW
      downloadExcelBtn: document.getElementById('download-excel'),
      // Total Stats
      totalCount: document.getElementById('total-count'),
      schoolCount: document.getElementById('school-count'),
      jcCount: document.getElementById('jc-count'),
      degreeCount: document.getElementById('degree-count'),
      
      // NEW All-Time Status Stats
      statusGrantedCount: document.getElementById('status-granted-count'),
      statusPendingCount: document.getElementById('status-pending-count'),
      statusRejectedCount: document.getElementById('status-rejected-count'),
      
      // NEW Stats for Today's Page (now Analytics page)
      todayTotalCount2: document.getElementById('today-total-count-2'),
      todaySchoolCount2: document.getElementById('today-school-count-2'),
      todayJcCount2: document.getElementById('today-jc-count-2'),
      todayDegreeCount2: document.getElementById('today-degree-count-2'),
      todayStatusGrantedCount2: document.getElementById('today-status-granted-count-2'),
      todayStatusPendingCount2: document.getElementById('today-status-pending-count-2'),
      todayStatusRejectedCount2: document.getElementById('today-status-rejected-count-2'),
    },
    modal: {
      el: document.getElementById('modal'),
      title: document.getElementById('modal-title'),
      body: document.getElementById('modal-body'),
      footer: document.getElementById('modal-footer'),
      closeBtn: document.getElementById('modal-close-btn'),
      actionBtn: document.getElementById('modal-action-btn'),
    },
    successPage: {
      token: document.getElementById('success-token'),
      downloadBtn: document.getElementById('download-jpg-btn'),
      homeBtn: document.getElementById('success-home-btn'),
      card: document.getElementById('success-card'),
    },
    errorMessage: document.getElementById('error-message'),
    footerYear: document.getElementById('footer-year'),
  };
  
  E.footerYear.textContent = new Date().getFullYear();

  try {
    G.app = initializeApp(firebaseConfig);
    G.auth = getAuth(G.app);
    G.db = getFirestore(G.app);
        } catch (err) {
    console.error('Firebase initialization failed:', err);
    showView('error');
    E.errorMessage.textContent = 'Failed to initialize Firebase. Check console for details.';
    return;
  }

  try {
    onAuthStateChanged(G.auth, (user) => {
      G.user = user;
      if (user) {
        showView('admin');
        try {
          const collectionPath = `artifacts/${appId}/public/data/enquiries`;
          const q = query(collection(G.db, collectionPath));
          
          onSnapshot(q, (snapshot) => {
            G.allEnquiries = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            
            // --- Calculate Stats ---
            
            // Section Stats (All Time)
            E.adminView.totalCount.textContent = G.allEnquiries.length;
            E.adminView.schoolCount.textContent = G.allEnquiries.filter(d => d.formSection === 'School').length;
            E.adminView.jcCount.textContent = G.allEnquiries.filter(d => d.formSection === 'Junior College').length;
            E.adminView.degreeCount.textContent = G.allEnquiries.filter(d => d.formSection === 'Degree College').length;
            
            // Status Stats (All Time)
            E.adminView.statusGrantedCount.textContent = G.allEnquiries.filter(d => d.admissionStatus === 'Granted').length;
            E.adminView.statusPendingCount.textContent = G.allEnquiries.filter(d => !d.admissionStatus || d.admissionStatus === 'Pending').length;
            E.adminView.statusRejectedCount.textContent = G.allEnquiries.filter(d => d.admissionStatus === 'Not Eligible').length;

            // Get Today's Enquiries
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayTimestamp = today.getTime();
            const todaysEnquiries = G.allEnquiries.filter(enq => enq.submittedAt && (enq.submittedAt.seconds * 1000) >= todayTimestamp);
            
            // Section Stats (Today)
            const todayTotal = todaysEnquiries.length;
            const todaySchool = todaysEnquiries.filter(d => d.formSection === 'School').length;
            const todayJc = todaysEnquiries.filter(d => d.formSection === 'Junior College').length;
            const todayDegree = todaysEnquiries.filter(d => d.formSection === 'Degree College').length;
            
            E.adminView.todayTotalCount2.textContent = todayTotal;
            E.adminView.todaySchoolCount2.textContent = todaySchool;
            E.adminView.todayJcCount2.textContent = todayJc;
            E.adminView.todayDegreeCount2.textContent = todayDegree;

            // Status Stats (Today)
            const todayGranted = todaysEnquiries.filter(d => d.admissionStatus === 'Granted').length;
            const todayPending = todaysEnquiries.filter(d => !d.admissionStatus || d.admissionStatus === 'Pending').length;
            const todayRejected = todaysEnquiries.filter(d => d.admissionStatus === 'Not Eligible').length;

            E.adminView.todayStatusGrantedCount2.textContent = todayGranted;
            E.adminView.todayStatusPendingCount2.textContent = todayPending;
            E.adminView.todayStatusRejectedCount2.textContent = todayRejected;

            renderAdminTable();
          }, (error) => {
            console.error("Error listening to Firestore:", error);
            E.adminView.tableBody.innerHTML = `<tr><td colspan="8" class="text-center p-10 text-red-500">Error loading data.</td></tr>`;
          });
        } catch (err_fs) {
          console.error("Firestore listener error:", err_fs);
            E.adminView.tableBody.innerHTML = `<tr><td colspan="8" class="text-center p-10 text-red-500">Error connecting to database.</td></tr>`;
        }
      } else {
        if (G.currentView === 'admin' || G.currentView === 'adminAnalytics') showView('public'); // <-- MODIFIED
        G.allEnquiries = []; 
      }
    });
  } catch (err) {
    console.warn('onAuthStateChanged error:', err);
  }

  E.nav.loginBtn?.addEventListener('click', () => showView('login'));
  E.nav.backBtn?.addEventListener('click', () => showView('public'));
  E.nav.adminSignOutBtn?.addEventListener('click', async () => {
    try { await signOut(G.auth); } catch (err) { console.warn(err); }
  });
  
  // NEW: Analytics Dashboard Nav
  E.nav.viewAnalyticsBtn?.addEventListener('click', () => showView('adminAnalytics'));
  E.nav.analyticsBackToMainBtn?.addEventListener('click', () => showView('admin'));

  // Modal close button
  E.modal.closeBtn?.addEventListener('click', hideModal);

  E.successPage.downloadBtn?.addEventListener('click', downloadSuccessJPG);
  E.successPage.homeBtn?.addEventListener('click', () => showView('public'));

  E.loginForm.form?.addEventListener('submit', handleLogin);
  
  // --- Admin Filter Listeners ---
  E.adminView.searchTerm?.addEventListener('input', renderAdminTable);
  E.adminView.searchField?.addEventListener('change', renderAdminTable);
  E.adminView.filterByStatus?.addEventListener('change', renderAdminTable); // <-- NEW
  E.adminView.downloadExcelBtn?.addEventListener('click', handleExcelDownload);
  
  // --- Admin Table Action Listeners ---
  E.adminView.tableBody?.addEventListener('click', (ev) => {
    // Stop if click was on the status dropdown
    if (ev.target.classList.contains('admin-status-select') || ev.target.classList.contains('admin-form-no-input')) {
        return;
    }
    
    const btn = ev.target.closest('.admin-view-details, .admin-edit-details, .admin-download-pdf');
    if (!btn) return;
    
    const id = btn.dataset.id;
    const enq = G.allEnquiries.find(x => x.id === id);
    if (!enq) return;

    const formType = btn.dataset.formType; 

    if (btn.classList.contains('admin-view-details')) {
        openViewModal(id, formType);
    } else if (btn.classList.contains('admin-edit-details')) {
        openEditModal(id, formType); 
    } else if (btn.classList.contains('admin-download-pdf')) {
        openDownloadModal(enq); 
    }
  });
  
  // NEW: Listener for status change dropdown
  E.adminView.tableBody?.addEventListener('change', handleStatusChange);

  // NEW: Listener for Admission Form No. input blur
  E.adminView.tableBody?.addEventListener('blur', handleFormNoChange, true); // Use capture phase

  // --- Public View Navigation ---
  document.addEventListener('click', (e) => {
    const navButton = e.target.closest('[data-form]');
    if (navButton) {
      const formId = navButton.dataset.form;
      const formType = navButton.dataset.type;
      if (formId && formType) {
        e.preventDefault();
        renderFormView(formId, formType);
      }
    }

    const dropdownButton = e.target.closest('[data-dropdown]');
    if (dropdownButton) {
      const dropdownId = dropdownButton.dataset.dropdown;
      const dropdown = document.getElementById(dropdownId);
      if (dropdown) {
        e.preventDefault();
        dropdown.classList.toggle('hidden');
        const icon = dropdownButton.querySelector('svg');
        if (icon) icon.classList.toggle('rotate-180');
      }
    }

    if (e.target.classList.contains('nav-back-home') || e.target.closest('.nav-back-home')) {
      e.preventDefault();
      showView('public');
    }
  });

  // Global submit listener for public forms (but not admin/edit)
  document.addEventListener('submit', (e) => {
    if (e.target.matches('form') && !e.target.id.includes('admin-login-form') && !e.target.id.includes('edit-form')) {
      e.preventDefault();
    }
  });
  
  showView(G.currentView || 'public');
}

// Start the application once the DOM is loaded
document.addEventListener('DOMContentLoaded', init);