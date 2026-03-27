"""
UNO Game Multi-Agent Orchestrator
----------------------------------
Pipeline:
  Design Agent → Design Review Agent (9-year-old) → Coding Agent → Code Review Agent

Each agent's output is saved to ./output/ so you can inspect every step.
"""

import json
import os
import re
import sys
from pathlib import Path

import anthropic

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MODEL = "claude-opus-4-6"
OUTPUT_DIR = Path("output")
MAX_DESIGN_LOOPS = 3   # Max times the 9-year-old can send the design back
MAX_CODE_LOOPS = 3     # Max times the code reviewer can send code back

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env


# ---------------------------------------------------------------------------
# System Prompts
# ---------------------------------------------------------------------------

DESIGN_AGENT_PROMPT = """You are a UI/UX designer specializing in games for children aged 7–10.
Your job is to produce a complete visual design specification for an online UNO card game.

PERSONALITY:
- You think in terms of delight, color, and clarity for young players
- You know children have short attention spans and need immediate visual feedback
- You avoid small text, muted colors, and complex layouts

OUTPUT FORMAT:
Always respond in this exact JSON structure (no text before or after the JSON):

{
  "color_palette": {
    "background": "<hex>",
    "primary": "<hex>",
    "accent": "<hex>",
    "card_red": "<hex>",
    "card_blue": "<hex>",
    "card_green": "<hex>",
    "card_yellow": "<hex>",
    "card_wild": "<hex>",
    "text_primary": "<hex>",
    "text_on_dark": "<hex>"
  },
  "typography": {
    "font_family": "<Google Font name>",
    "card_number_size": "<px>",
    "button_size": "<px>",
    "label_size": "<px>"
  },
  "layout": {
    "card_width": "<px>",
    "card_height": "<px>",
    "card_border_radius": "<px>",
    "player_hand_position": "bottom",
    "opponent_hand_position": "top",
    "draw_pile_position": "<center-left | center-right | center>",
    "discard_pile_position": "<center-left | center-right | center>"
  },
  "animations": {
    "card_play": "<description of animation>",
    "draw_card": "<description>",
    "win_screen": "<description>",
    "special_card_effect": "<description>"
  },
  "ui_components": {
    "buttons": "<description of button style>",
    "player_name_tag": "<description>",
    "card_count_badge": "<description>",
    "uno_button": "<description — this is the button the player presses when they have 1 card>"
  },
  "sound_design": {
    "card_play": "<description>",
    "draw_card": "<description>",
    "win": "<description>",
    "uno_call": "<description>"
  },
  "rationale": "<2–3 sentences explaining your design decisions and why they work for a 9-year-old>"
}

RULES:
- Output ONLY the JSON object, nothing else
- Colors must be vibrant and high-contrast, never pastel or muted
- Font must be playful but still readable at small sizes
- Every design decision must prioritize a child's experience"""


DESIGN_REVIEW_AGENT_PROMPT = """You are a 9-year-old kid who loves playing games on tablets and phones.
You are reviewing the design of an UNO game that someone made for you.

PERSONALITY:
- You say exactly what you think, no filter
- You get excited about cool stuff and complain loudly about boring stuff
- You compare everything to games you already love (Roblox, Minecraft, Mario Kart)
- You don't use design vocabulary — you say "the buttons look weird" not "the affordances are unclear"
- You have strong opinions about colors ("ew that's ugly", "YES that's so cool")
- You get bored with anything that looks like a school app

YOUR JOB:
Read the design spec and give honest feedback as a kid.

OUTPUT FORMAT:
Output ONLY this JSON object, nothing else:
{
  "overall_reaction": "<LOVE IT | IT'S OK | MEH | BORING | GROSS>",
  "favorite_thing": "<what you liked most, in kid language>",
  "complaints": [
    "<complaint 1>",
    "<complaint 2>"
  ],
  "requests": [
    "<thing you want changed or added, in kid language>"
  ],
  "approved": true or false,
  "approval_note": "<one sentence — would you play this game or not, and why>"
}

RULES:
- If overall_reaction is LOVE IT or IT'S OK, set approved: true
- If MEH, BORING, or GROSS, set approved: false
- Never use adult design words
- Be specific — say which colors or parts you're talking about
- You can be won over by cool animations and fun fonts
- Output ONLY the JSON object"""


CODING_AGENT_PROMPT = """You are a senior frontend developer implementing a browser-based UNO card game.
You receive a finalized design specification and must implement it exactly.

TECH STACK:
- Single HTML file (HTML + CSS + JS, no frameworks, no build tools)
- Vanilla JavaScript only
- No external dependencies except Google Fonts (loaded via <link>)
- Must run by opening the file directly in a browser (no server required)

GAME RULES YOU MUST IMPLEMENT CORRECTLY:
- Standard UNO deck: 108 cards (0–9 in 4 colors × 2 each, plus action cards: Skip, Reverse,
  Draw Two × 2 per color; wild cards: 4× Wild, 4× Wild Draw Four)
- Players: 1 human vs 2 AI opponents
- Turn order, color matching, number matching
- Special card effects:
    Skip — skips next player's turn
    Reverse — flips direction of play
    Draw Two — forces next player to draw 2 cards and skip their turn
    Wild — current player chooses the active color
    Wild Draw Four — current player chooses color AND next player draws 4 and is skipped
- UNO button: player must press it when they play down to 1 card; if caught before pressing,
  they draw 2 penalty cards
- Win condition: first player to empty their hand wins
- AI behavior: plays valid cards, uses action cards strategically, calls UNO automatically

OUTPUT FORMAT:
Output ONLY a complete, valid HTML file. No explanation text before or after.
Start your response with <!DOCTYPE html> and end with </html>.
The file must be self-contained and playable immediately.

DESIGN ADHERENCE:
- Use the exact hex colors from the design spec
- Use the exact font from the design spec (load via Google Fonts)
- Match the layout positions described in the spec
- Implement the animations described in the spec using CSS transitions/animations

CODE QUALITY:
- Separate <style> and <script> sections clearly
- Comment each major section (card rendering, game logic, AI logic, event handling)
- Use const/let, arrow functions, modern JS (ES2020+)
- Wrap all game state in a single gameState object — no loose global variables"""


CODE_REVIEW_AGENT_PROMPT = """You are a senior software engineer and child safety expert reviewing a browser-based UNO game.

YOUR FOCUS AREAS:
1. CORRECTNESS — Does the UNO game logic follow the actual rules?
2. CHILD SAFETY — Is the UI appropriate for a 9-year-old? No dark patterns, no confusing flows
3. CODE QUALITY — Is the code readable, maintainable, free of obvious bugs?
4. BROWSER COMPATIBILITY — Will it work in Chrome, Safari, Firefox without a server?
5. ACCESSIBILITY — Can a child with color blindness still play? Are click targets large enough?

OUTPUT FORMAT:
Output ONLY this JSON object, nothing else:
{
  "verdict": "<APPROVED | NEEDS_CHANGES | REJECTED>",
  "game_logic_issues": [
    {
      "severity": "<critical | major | minor>",
      "description": "<what is wrong>",
      "location": "<function name or line description>",
      "fix": "<what to do>"
    }
  ],
  "child_safety_issues": [
    {
      "severity": "<critical | major | minor>",
      "description": "<issue>",
      "fix": "<what to do>"
    }
  ],
  "code_quality_issues": [
    {
      "severity": "<critical | major | minor>",
      "description": "<issue>",
      "location": "<where>",
      "fix": "<what to do>"
    }
  ],
  "accessibility_issues": [
    {
      "severity": "<critical | major | minor>",
      "description": "<issue>",
      "fix": "<what to do>"
    }
  ],
  "approved_aspects": [
    "<thing that was done well>"
  ],
  "summary": "<2–3 sentences: overall quality and what must change before shipping>"
}

VERDICT RULES:
- APPROVED: no critical issues, minor issues only
- NEEDS_CHANGES: has major issues that must be fixed, but the structure is sound
- REJECTED: has critical issues or fundamental logic errors — must be rewritten"""


# ---------------------------------------------------------------------------
# Agent call helpers
# ---------------------------------------------------------------------------

def stream_agent(system_prompt: str, user_message: str, label: str) -> str:
    """
    Call Claude with the given system prompt and user message.
    Streams output to the terminal for visibility, returns the full response text.
    """
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}\n")

    full_text = ""

    with client.messages.stream(
        model=MODEL,
        max_tokens=64000,
        thinking={"type": "adaptive"},
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    ) as stream:
        for event in stream:
            if event.type == "content_block_delta":
                if hasattr(event.delta, "text"):
                    chunk = event.delta.text
                    print(chunk, end="", flush=True)
                    full_text += chunk

    print()  # newline after streaming
    return full_text


def extract_json(text: str) -> dict:
    """
    Extract the first JSON object from a text response.
    Handles cases where the model wraps JSON in markdown code fences.
    """
    # Strip markdown code fences if present
    text = re.sub(r"```(?:json)?\s*", "", text).strip()
    text = re.sub(r"```\s*$", "", text).strip()

    # Find first { and last } to extract the JSON object
    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"No JSON object found in response:\n{text[:500]}")

    json_str = text[start:end]
    return json.loads(json_str)


def save(filename: str, content: str) -> Path:
    """Save content to the output directory and return the path."""
    OUTPUT_DIR.mkdir(exist_ok=True)
    path = OUTPUT_DIR / filename
    path.write_text(content, encoding="utf-8")
    print(f"\n  [saved] {path}")
    return path


# ---------------------------------------------------------------------------
# Agent pipeline steps
# ---------------------------------------------------------------------------

def run_design_agent(feedback: str | None = None) -> dict:
    """
    Calls the Design Agent to produce a design spec.
    If feedback is provided, the agent is asked to revise based on it.
    """
    if feedback:
        user_msg = (
            "A 9-year-old reviewed your last design and was not happy. "
            "Their feedback:\n\n"
            f"{feedback}\n\n"
            "Please revise the design to address their complaints and requests. "
            "Output the updated design spec JSON."
        )
    else:
        user_msg = (
            "Create a complete visual design specification for an online UNO card game "
            "targeting 9-year-old players. Output the design spec JSON."
        )

    raw = stream_agent(DESIGN_AGENT_PROMPT, user_msg, "DESIGN AGENT")
    spec = extract_json(raw)
    save("design_spec.json", json.dumps(spec, indent=2))
    return spec


def run_design_review_agent(spec: dict) -> dict:
    """
    Calls the 9-year-old Design Review Agent to evaluate the design spec.
    """
    user_msg = (
        "Here is the design spec for my UNO game. Tell me what you think!\n\n"
        f"{json.dumps(spec, indent=2)}"
    )
    raw = stream_agent(DESIGN_REVIEW_AGENT_PROMPT, user_msg, "DESIGN REVIEW AGENT (9-year-old)")
    review = extract_json(raw)
    save("design_review.json", json.dumps(review, indent=2))
    return review


def run_coding_agent(spec: dict, issues: list[dict] | None = None) -> str:
    """
    Calls the Coding Agent to produce the game HTML.
    If issues is provided, the agent is asked to fix them.
    """
    spec_json = json.dumps(spec, indent=2)

    if issues:
        issues_text = json.dumps(issues, indent=2)
        user_msg = (
            "The code reviewer found issues with your UNO game. "
            "Please fix all of them.\n\n"
            f"ISSUES TO FIX:\n{issues_text}\n\n"
            f"ORIGINAL DESIGN SPEC:\n{spec_json}\n\n"
            "Output the complete corrected HTML file."
        )
    else:
        user_msg = (
            f"Here is the approved design spec:\n\n{spec_json}\n\n"
            "Implement the complete UNO game as a single self-contained HTML file. "
            "Output ONLY the HTML file — nothing else."
        )

    raw = stream_agent(CODING_AGENT_PROMPT, user_msg, "CODING AGENT")

    # The coding agent should output raw HTML — find it if wrapped
    if "<!DOCTYPE html>" in raw:
        start = raw.index("<!DOCTYPE html>")
        # Find closing </html> tag
        end = raw.rfind("</html>") + len("</html>")
        raw = raw[start:end]

    save("game.html", raw)
    return raw


def run_code_review_agent(html: str) -> dict:
    """
    Calls the Code Review Agent to evaluate the game HTML.
    """
    user_msg = (
        "Please review this UNO game implementation for correctness, child safety, "
        "code quality, and accessibility.\n\n"
        f"```html\n{html}\n```"
    )
    raw = stream_agent(CODE_REVIEW_AGENT_PROMPT, user_msg, "CODE REVIEW AGENT")
    review = extract_json(raw)
    save("code_review.json", json.dumps(review, indent=2))
    return review


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def collect_issues(review: dict, severity_threshold: str = "major") -> list[dict]:
    """
    Collect all issues from a code review at or above the given severity.
    severity_threshold: 'critical', 'major', or 'minor'
    """
    severity_rank = {"critical": 3, "major": 2, "minor": 1}
    threshold_rank = severity_rank[severity_threshold]

    issues = []
    for category in ["game_logic_issues", "child_safety_issues", "code_quality_issues", "accessibility_issues"]:
        for issue in review.get(category, []):
            if severity_rank.get(issue.get("severity", "minor"), 1) >= threshold_rank:
                issues.append({**issue, "category": category})
    return issues


def run_pipeline():
    print("\n🃏  UNO GAME MULTI-AGENT PIPELINE")
    print("=" * 60)

    # ── PHASE 1: Design ─────────────────────────────────────────
    print("\n📐 PHASE 1: Design")
    feedback = None
    approved_spec = None

    for design_attempt in range(1, MAX_DESIGN_LOOPS + 1):
        print(f"\n  Design attempt {design_attempt}/{MAX_DESIGN_LOOPS}")

        spec = run_design_agent(feedback=feedback)
        review = run_design_review_agent(spec)

        print(f"\n  9-year-old's verdict: {review['overall_reaction']}")
        print(f"  Approved: {review['approved']}")
        print(f"  Note: {review['approval_note']}")

        if review["approved"]:
            approved_spec = spec
            print("\n  ✅ Design approved!")
            break
        else:
            print("\n  ❌ Design rejected. Feeding back complaints...")
            complaints = "\n".join(f"- {c}" for c in review.get("complaints", []))
            requests = "\n".join(f"- {r}" for r in review.get("requests", []))
            feedback = f"Complaints:\n{complaints}\n\nRequests:\n{requests}"

    if approved_spec is None:
        print(f"\n  ⚠️  Design not approved after {MAX_DESIGN_LOOPS} attempts.")
        print("  Using last design spec anyway...")
        approved_spec = spec

    # ── PHASE 2: Coding ─────────────────────────────────────────
    print("\n\n💻 PHASE 2: Coding")
    issues_to_fix = None
    final_html = None

    for code_attempt in range(1, MAX_CODE_LOOPS + 1):
        print(f"\n  Code attempt {code_attempt}/{MAX_CODE_LOOPS}")

        html = run_coding_agent(approved_spec, issues=issues_to_fix)
        review = run_code_review_agent(html)

        print(f"\n  Code review verdict: {review['verdict']}")
        print(f"  Summary: {review['summary']}")

        if review["verdict"] == "APPROVED":
            final_html = html
            print("\n  ✅ Code approved!")
            break
        elif review["verdict"] == "REJECTED":
            print("\n  🔴 Code REJECTED. Major rewrite needed.")
            issues_to_fix = collect_issues(review, severity_threshold="major")
        else:  # NEEDS_CHANGES
            print("\n  🟡 Code needs changes.")
            issues_to_fix = collect_issues(review, severity_threshold="major")

        if code_attempt == MAX_CODE_LOOPS:
            final_html = html
            print(f"\n  ⚠️  Max code attempts reached. Saving last version.")

    # ── SUMMARY ─────────────────────────────────────────────────
    print("\n\n" + "=" * 60)
    print("  PIPELINE COMPLETE")
    print("=" * 60)
    print(f"\n  Output files in: {OUTPUT_DIR.absolute()}")
    print(f"    design_spec.json   — approved design")
    print(f"    design_review.json — 9-year-old's feedback")
    print(f"    game.html          — the game (open in browser!)")
    print(f"    code_review.json   — code review findings")

    if final_html:
        game_path = OUTPUT_DIR / "game.html"
        print(f"\n  🎮 Open this to play: file://{game_path.absolute()}")


if __name__ == "__main__":
    # Require API key
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("Error: ANTHROPIC_API_KEY environment variable is not set.")
        sys.exit(1)

    run_pipeline()
