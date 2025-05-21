import os

# Google Gemini API Configuration
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-pro"  # Use the most capable model available

# Define the steps in the Working Backwards process
WORKING_BACKWARDS_STEPS = [
    {
        "id": 1,
        "name": "Drafting Press Release",
        "persona": "Product Manager Persona",
        "description": "Drafting an initial internal press release for the product idea.",
        "system_prompt": "You are an expert Amazon Product Manager. Your goal is to draft an initial internal press release for a new product idea. This press release should be customer-obsessed, focusing on the problem this product solves, its core benefits, and how it will delight customers. Be bold and visionary.",
        "user_prompt": """
Product Idea: "{input}"

Draft a press release with the following sections:
- Headline: (Create a compelling headline for the product)
- Sub-Heading: (One sentence describing the product and its primary benefit for the customer)
- Summary Paragraph: (Start with a proposed launch city/date - e.g., Seattle, WA - [Future Date] - and summarize the product and its most important benefits)
- Problem Paragraph: (Clearly describe the customer problem this product solves)
- Solution Paragraph: (Describe how your product elegantly solves this problem)
- Quote from [Your Name/Company Name]: (A quote explaining the vision or excitement for this product)
- How to Get Started: (A brief call to action or explanation of how customers will access/use the product)
- Customer Quote: (A hypothetical quote from a delighted customer experiencing the benefits of the product)
"""
    },
    {
        "id": 2,
        "name": "Refining Press Release",
        "persona": "Marketing Lead Persona",
        "description": "Refining the press release to make it more impactful and persuasive.",
        "system_prompt": "You are a seasoned Marketing Lead at a major tech company, known for crafting compelling narratives. Your task is to review and refine the provided press release to make it more impactful, clear, and persuasive for the target customer audience. Focus on strong messaging and highlighting the unique value proposition.",
        "user_prompt": """
Original Press Release Draft:
---
{input}
---

Review the draft above and provide a revised press release. Ensure the language is engaging, the benefits are crystal clear, and the overall message resonates strongly with potential customers.
"""
    },
    {
        "id": 3,
        "name": "Drafting External FAQ",
        "persona": "Customer Advocate & PM Persona",
        "description": "Creating FAQs that potential customers might ask after reading the press release.",
        "system_prompt": "You are a Customer Advocate and a Product Manager. Your goal is to anticipate questions a potential customer would have after reading the press release. First, list 5-7 key questions. Then, provide clear, concise, and customer-friendly answers to these questions.",
        "user_prompt": """
Press Release:
---
{input}
---

Based on the press release above:
1.  List 5-7 questions a potential customer might ask.
2.  For each question, provide a clear and helpful answer.

Format your response as:
Q1: [Question]
A1: [Answer]

Q2: [Question]
A2: [Answer]
...
"""
    },
    {
        "id": 4,
        "name": "Drafting Internal FAQ",
        "persona": "Lead Engineer & PM Persona",
        "description": "Creating FAQs that internal stakeholders would ask about feasibility and resources.",
        "system_prompt": "You are a pragmatic Lead Engineer and an experienced Product Manager. After reading the product's press release, your task is to identify critical questions that internal stakeholders (such as engineering leadership, finance, and operations) would ask. Focus on feasibility, resources, risks, technical approach, and business implications. List 5-7 key questions and provide thoughtful initial answers or identify key areas needing further investigation.",
        "user_prompt": """
Press Release:
---
{input}
---

Based on the press release above:
1.  List 5-7 critical questions internal stakeholders might ask.
2.  For each question, provide an initial answer, or state what needs to be investigated.

Format your response as:
Q1: [Question]
A1: [Answer or Area for Investigation]

Q2: [Question]
A2: [Answer or Area for Investigation]
...
"""
    },
    {
        "id": 5,
        "name": "Synthesizing PRFAQ Document",
        "persona": "Editor Persona",
        "description": "Combining the press release and FAQs into a coherent PRFAQ document.",
        "system_prompt": "You are a meticulous Editor. Your task is to combine the provided Press Release, External FAQ, and Internal FAQ into a single, coherent, and well-formatted PRFAQ document. Ensure consistent tone and clarity. If the Internal FAQ highlighted critical unanswered questions or major risks, list them under a separate 'Key Considerations & Risks' section at the end of the document.",
        "user_prompt": """
Refined Press Release:
---
{refined_press_release}
---

External FAQ:
---
{external_faq}
---

Internal FAQ:
---
{internal_faq}
---

Combine these into a single PRFAQ document. Structure it as:
1.  Press Release
2.  External FAQ
3.  Internal FAQ
4.  Key Considerations & Risks (if any were explicitly identified as needing investigation or being major risks in the Internal FAQ)
"""
    },
    {
        "id": 6,
        "name": "Defining MLP Plan",
        "persona": "PM & Lead Engineer Persona",
        "description": "Creating a Minimum Lovable Product plan based on the PRFAQ document.",
        "system_prompt": "You are a strategic Product Manager and a practical Lead Engineer. Based on the provided PRFAQ document, your goal is to define a Minimum Lovable Product (MLP) plan. This plan should focus on delivering core value and delighting early adopters quickly.",
        "user_prompt": """
PRFAQ Document:
---
{input}
---

Based on the PRFAQ, define an MLP plan with the following sections:
1.  **MLP Core Problem:** What is the single most important customer problem this MLP will solve exceptionally well?
2.  **Target Early Adopter:** Briefly describe the ideal early user for this MLP.
3.  **Core Lovable Features (3-5 maximum):** List the essential features that will make this MLP functional and delightful. For each, briefly explain why it's lovable.
4.  **Key Success Metrics for MLP:** How will you measure if the MLP is successful and lovable (e.g., user engagement, satisfaction scores, specific task completion rates)?
5.  **High-Level Technical Considerations/Risks for MLP:** What are the immediate technical challenges or risks for building these core features?
"""
    }
]
