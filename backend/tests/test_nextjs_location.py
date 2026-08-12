import os
import shutil
import tempfile
import unittest
from pathlib import Path

from backend.agents.fix_agent import FixAgent
from backend.core.adapters import detect_framework, get_adapter, _nextjs_path_variants, _nextjs_precheck


class NextJsLocationAndResilienceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_nextjs_")
        self.repo_path = Path(self.temp_dir)

    def tearDown(self):
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_nextjs_path_variants_no_duplicate_api(self):
        variants = _nextjs_path_variants("/api/notes")
        # Ensure no accidental double api/api/ variants
        self.assertNotIn("app/api/api/notes/route.ts", variants)
        self.assertNotIn("pages/api/api/notes.ts", variants)
        # Ensure correct App Router and Pages Router variants exist
        self.assertIn("app/api/notes/route.ts", variants)
        self.assertIn("pages/api/notes.ts", variants)
        self.assertIn("src/app/api/notes/route.ts", variants)
        self.assertIn("src/pages/api/notes.ts", variants)

    def test_nextjs_path_variants_dashboard(self):
        variants = _nextjs_path_variants("/dashboard")
        self.assertIn("pages/dashboard.tsx", variants)
        self.assertIn("pages/dashboard/index.tsx", variants)
        self.assertIn("app/dashboard/page.tsx", variants)
        self.assertIn("src/pages/dashboard.tsx", variants)

    def test_locate_app_router_api_notes(self):
        route_dir = self.repo_path / "app" / "api" / "notes"
        route_dir.mkdir(parents=True, exist_ok=True)
        route_file = route_dir / "route.ts"
        route_file.write_text("""import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ notes: [] });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ success: true });
}
""", encoding="utf-8")

        agent = FixAgent(db=None, session_id="test", framework="nextjs")
        agent._repo_path = str(self.repo_path)
        agent._adapter = get_adapter("nextjs")

        loc = agent._locate_endpoint_programmatically("/api/notes", "GET")
        self.assertIsNotNone(loc)
        self.assertEqual(loc["file_path"].replace("\\", "/"), "app/api/notes/route.ts")
        self.assertEqual(loc["target_function"], "GET")
        self.assertIn("export async function GET", loc["original_code"])

    def test_locate_pages_router_dashboard_page(self):
        pages_dir = self.repo_path / "pages"
        pages_dir.mkdir(parents=True, exist_ok=True)
        page_file = pages_dir / "dashboard.tsx"
        page_file.write_text("""import React from 'react';

export async function getServerSideProps() {
  return { props: { data: 'ok' } };
}

export default function Dashboard() {
  return <div>Dashboard</div>;
}
""", encoding="utf-8")

        agent = FixAgent(db=None, session_id="test", framework="nextjs")
        agent._repo_path = str(self.repo_path)
        agent._adapter = get_adapter("nextjs")

        loc = agent._locate_endpoint_programmatically("/dashboard", "GET")
        self.assertIsNotNone(loc)
        self.assertEqual(loc["file_path"].replace("\\", "/"), "pages/dashboard.tsx")
        self.assertTrue("getServerSideProps" in loc["original_code"] or "Dashboard" in loc["original_code"])

    def test_locate_pages_router_api_notes(self):
        pages_api = self.repo_path / "pages" / "api"
        pages_api.mkdir(parents=True, exist_ok=True)
        notes_file = pages_api / "notes.ts"
        notes_file.write_text("""import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ notes: [] });
}
""", encoding="utf-8")

        agent = FixAgent(db=None, session_id="test", framework="nextjs")
        agent._repo_path = str(self.repo_path)
        agent._adapter = get_adapter("nextjs")

        loc = agent._locate_endpoint_programmatically("/api/notes", "GET")
        self.assertIsNotNone(loc)
        self.assertEqual(loc["file_path"].replace("\\", "/"), "pages/api/notes.ts")
        self.assertEqual(loc["target_function"], "default_handler")
        self.assertIn("export default async function handler", loc["original_code"])

    def test_supabase_raw_error_leak_precheck(self):
        code_leaking = """export default async function handler(req, res) {
  const { data, error } = await supabase.from('notes').select('*');
  if (error) {
    return res.status(500).json(error);
  }
  return res.status(200).json(data);
}"""
        issues = _nextjs_precheck(code_leaking, imports=[])
        self.assertTrue(any("Raw Supabase error object" in issue for issue in issues))

    def test_supabase_safe_error_handling_precheck(self):
        code_safe = """export default async function handler(req, res) {
  try {
    const { data, error } = await supabase.from('notes').select('*');
    if (error) {
      console.error('Supabase query error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch notes' });
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error('Unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}"""
        issues = _nextjs_precheck(code_safe, imports=[])
    def test_locate_pascalcase_src_pages_dashboard(self):
        pages_dir = self.repo_path / "src" / "pages"
        pages_dir.mkdir(parents=True, exist_ok=True)
        page_file = pages_dir / "Dashboard.tsx"
        page_file.write_text("""import React from 'react';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  return <div>Dashboard Content</div>;
}
""", encoding="utf-8")

        agent = FixAgent(db=None, session_id="test", framework="nextjs")
        agent._repo_path = str(self.repo_path)
        agent.language = "typescript"

        loc = agent._locate_endpoint_programmatically("/dashboard", "GET")
        self.assertIsNotNone(loc)
        self.assertEqual(loc["file_path"].replace("\\", "/"), "src/pages/Dashboard.tsx")

    def test_locate_pascalcase_src_pages_notes(self):
        pages_dir = self.repo_path / "src" / "pages"
        pages_dir.mkdir(parents=True, exist_ok=True)
        page_file = pages_dir / "Notes.tsx"
        page_file.write_text("""import React from 'react';
import { supabase } from '../lib/supabase';

export default function Notes() {
  return <div>Notes Content</div>;
}
""", encoding="utf-8")

        agent = FixAgent(db=None, session_id="test", framework="nextjs")
        agent._repo_path = str(self.repo_path)
        agent.language = "typescript"

        loc = agent._locate_endpoint_programmatically("/notes", "GET")
        self.assertIsNotNone(loc)
        self.assertEqual(loc["file_path"].replace("\\", "/"), "src/pages/Notes.tsx")

    def test_trace_component_from_react_router_app_tsx(self):
        src_dir = self.repo_path / "src"
        pages_dir = src_dir / "pages"
        pages_dir.mkdir(parents=True, exist_ok=True)

        notes_file = pages_dir / "Notes.tsx"
        notes_file.write_text("""export default function Notes() { return <div>Notes</div>; }""", encoding="utf-8")

        app_file = src_dir / "App.tsx"
        app_file.write_text("""import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Notes from './pages/Notes';

export function App() {
  return (
    <Routes>
      <Route path="/notes" element={<Notes />} />
    </Routes>
  );
}
""", encoding="utf-8")

        agent = FixAgent(db=None, session_id="test", framework="nextjs")
        agent._repo_path = str(self.repo_path)
        agent.language = "typescript"

        loc = agent._locate_endpoint_programmatically("/notes", "GET")
        self.assertIsNotNone(loc)
        # Must resolve to the actual component in src/pages/Notes.tsx, NOT App.tsx
        self.assertEqual(loc["file_path"].replace("\\", "/"), "src/pages/Notes.tsx")


if __name__ == "__main__":
    unittest.main()

