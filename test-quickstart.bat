@echo off
echo.
echo ================================================
echo   PHASE 4: ANALYTICS TESTING - QUICK START
echo ================================================
echo.
echo Follow these steps in order:
echo.
echo STEP 1: Generate Test Data
echo    1. Open: https://earn4insights.vercel.app
echo    2. Sign in with Google
echo    3. Complete onboarding (if needed)
echo    4. View 3-4 products from /top-products
echo    5. Visit different categories
echo    6. Wait 30 seconds
echo.
echo STEP 2: Verify Events (run after Step 1)
echo    Command: node test-event-tracking.mjs
echo.
echo STEP 3: Check Analytics
echo    Command: node test-analytics.mjs
echo.
echo STEP 4: Compute Behavioral Data
echo    Command: node test-behavioral-update.mjs
echo.
echo STEP 5: Test Recommendations
echo    Command: node test-recommendations.mjs
echo.
echo ================================================
echo Current Status: No events in database yet
echo Action Required: Complete STEP 1 first
echo Documentation: PHASE_4_TESTING_GUIDE.md
echo ================================================
echo.
