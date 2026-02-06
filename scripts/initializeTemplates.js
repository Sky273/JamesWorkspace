// @ts-check
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import axios from 'axios';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the root .env file
dotenv.config({ path: resolve(__dirname, '../.env') });

const AIRTABLE_API_URL = 'https://api.airtable.com/v0';
const BASE_ID = process.env.VITE_AIRTABLE_BASE_ID;
const PAT = process.env.VITE_AIRTABLE_PAT;

if (!BASE_ID || !PAT) {
  console.error('Missing required environment variables. Please check your .env file.');
  process.exit(1);
}

const airtableInstance = axios.create({
  baseURL: `${AIRTABLE_API_URL}/${BASE_ID}`,
  headers: {
    'Authorization': `Bearer ${PAT}`,
    'Content-Type': 'application/json',
  },
});

const initialTemplates = [
  {
    fields: {
      Name: 'Professional Classic',
      Description: 'A timeless template perfect for traditional industries',
      Popular: true,
      Status: 'Active',
      Tags: ['Modern', 'Clean'],
      TemplateContent: '<!-- Template content here -->'
    }
  },
  {
    fields: {
      Name: 'Modern Minimal',
      Description: 'Clean and contemporary design for creative professionals',
      Popular: true,
      Status: 'Active',
      Tags: ['Minimal', 'Creative'],
      TemplateContent: '<!-- Template content here -->'
    }
  },
  {
    fields: {
      Name: 'Tech Impact',
      Description: 'Optimized for tech and IT professionals',
      Popular: false,
      Status: 'Active',
      Tags: ['Technical', 'Modern'],
      TemplateContent: '<!-- Template content here -->'
    }
  },
  {
    fields: {
      Name: 'Executive Suite',
      Description: 'Elegant design for senior positions and management roles',
      Popular: false,
      Status: 'Active',
      Tags: ['Professional', 'Executive'],
      TemplateContent: '<!-- Template content here -->'
    }
  },
  {
    fields: {
      Name: 'Creative Portfolio',
      Description: 'Visual-focused layout for creative industries',
      Popular: true,
      Status: 'Active',
      Tags: ['Creative', 'Portfolio'],
      TemplateContent: '<!-- Template content here -->'
    }
  },
  {
    fields: {
      Name: 'Data Specialist',
      Description: 'Structured layout for data-driven roles',
      Popular: false,
      Status: 'Active',
      Tags: ['Technical', 'Data'],
      TemplateContent: '<!-- Template content here -->'
    }
  }
];

async function createTemplatesTable() {
  try {
    // Create records in batches of 10 (Airtable limit)
    for (let i = 0; i < initialTemplates.length; i += 10) {
      const batch = initialTemplates.slice(i, i + 10);
      await airtableInstance.post('/Templates', {
        records: batch
      });
      console.log(`Created templates ${i + 1} to ${Math.min(i + 10, initialTemplates.length)}`);
    }
    console.log('Successfully initialized templates table');
  } catch (error) {
    if (error.response?.status === 404) {
      console.error('Error: Templates table not found. Please create a table named "Templates" in your Airtable base first.');
      console.log('\nRequired fields:');
      console.log('- Name (Single line text)');
      console.log('- Description (Long text)');
      console.log('- Popular (Checkbox)');
      console.log('- Status (Single select)');
      console.log('- Tags (Multiple select)');
      console.log('- TemplateContent (Long text)');
    } else {
      console.error('Error initializing templates:', error.response?.data || error.message);
    }
  }
}

createTemplatesTable();
