FILES=(
"frontend/src/pages/admin/b2b-rules.astro"
"frontend/src/pages/admin/configuracion.astro"
"frontend/src/pages/admin/monitoreo.astro"
"frontend/src/pages/admin/promociones.astro"
"frontend/src/pages/api/order.ts"
"frontend/src/pages/api/admin/b2b.ts"
"frontend/src/pages/api/admin/export.ts"
"frontend/src/pages/ofertas.astro"
"frontend/src/pages/api/admin/products.ts"
"frontend/src/pages/index.astro"
"frontend/src/pages/admin/b2b.astro"
"frontend/src/pages/admin/cupones.astro"
"frontend/src/pages/api/auth/login.ts"
"frontend/src/pages/api/auth/reset-password.ts"
"frontend/src/pages/admin/categories.astro"
"frontend/src/pages/sitemap.xml.ts"
"frontend/src/pages/api/webhook/mp.ts"
"frontend/src/pages/admin/index.astro"
"frontend/src/pages/admin/sync.astro"
"frontend/src/pages/admin/products.astro"
"frontend/src/pages/admin/orders.astro"
"frontend/src/pages/api/checkout.ts"
"frontend/src/pages/api/profile.ts"
"frontend/src/pages/api/admin/categories.ts"
"frontend/src/pages/api/notifications.ts"
"frontend/src/pages/api/admin/monitoreo.ts"
"frontend/src/pages/api/search.ts"
"frontend/src/pages/api/favorites.ts"
"frontend/src/pages/api/admin/promociones.ts"
"frontend/src/pages/api/reviews.ts"
"frontend/src/pages/api/admin/configuracion.ts"
"frontend/src/pages/api/admin/orders.ts"
"frontend/src/pages/api/auth/forgot-password.ts"
"frontend/src/pages/api/b2b/register.ts"
"frontend/src/pages/api/auth/google.ts"
"frontend/src/pages/api/auth/register.ts"
"frontend/src/pages/categoria/[slug].astro"
"frontend/src/pages/busqueda/[q].astro"
"frontend/src/lib/auth.ts"
)

for FILE in "${FILES[@]}"; do
  if [ ! -f "$FILE" ]; then
    continue
  fi
  
  # Find lines with .prepare(
  LINES=$(grep -n "\.prepare(" "$FILE")
  
  if [ -z "$LINES" ]; then
    # No prepare calls, but still report as OK if it was in the list
    echo "$FILE: [OK]"
    continue
  fi

  FILE_OK=true
  ISSUES=""

  while IFS= read -r LINE; do
    LINE_NUM=$(echo "$LINE" | cut -d: -f1)
    
    # Check if wrapped in try-catch
    # This is a heuristic: look for 'try {' before the line and 'catch' after it in the same function scope
    # Since we are in bash, we'll use a simpler approach:
    # Check if the file contains 'try' and 'catch' generally, but that's not precise.
    # Better: check if the specific call is inside a try-catch by looking at the surrounding lines.
    
    # We'll use a small python script for better block analysis if needed, 
    # but for now let's just report them as potential issues and verify manually or with a better tool.
    # Actually, let's just extract the context for each call.
    
    CONTEXT=$(sed -n "$((LINE_NUM-5)),$((LINE_NUM+5))p" "$FILE")
    if [[ ! "$CONTEXT" =~ "try" ]] || [[ ! "$CONTEXT" =~ "catch" ]]; then
      # Heuristic check for try-catch in vicinity
      # If not found in 5 lines, it might be wrapped further out.
      # Let's just mark as ISSUE for manual verification of wrap and null check.
      FILE_OK=false
      ISSUES+="\n  Line $LINE_NUM: .prepare() call potentially missing local try-catch or null-check."
    fi
  done <<< "$LINES"

  if [ "$FILE_OK" = true ]; then
    echo "$FILE: [OK]"
  else
    echo -e "$FILE: [ISSUE]$ISSUES"
  fi
done
