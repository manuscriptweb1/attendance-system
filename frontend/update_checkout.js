const fs = require('fs');
const path = require('path');

const dashboardPath = path.resolve('c:/Project-attendance/frontend/src/pages/EmployeeDashboard.js');
let content = fs.readFileSync(dashboardPath, 'utf8');

const originalCheckoutBlock = `        setIsCheckingOut(true);
        try {
          setLocationDialog({ isOpen:true, title:settings.messages.locationPermissionTitle, message:settings.messages.locationPermissionMessage, type:'permission',
            onAllow: async () => {
              try {
                setCheckOutMessage('Getting your location...');
                const location = await getCurrentLocation();
                setCheckOutMessage('Collecting device information...');
                const deviceInfo = getDeviceInfo();
                const fingerprintData = getDeviceFingerprintData();
                setCheckOutMessage('Processing check-out...');
                const response = await checkOut({
                  latitude: location.latitude,
                  longitude: location.longitude,
                  address: 'Location captured',
                  device_info: deviceInfo.device_info,
                  browser_info: deviceInfo.browser_info,
                  screenResolution: fingerprintData.screenResolution,
                  timezone: fingerprintData.timezone,
                  sessionId: localStorage.getItem('attendance_session_id')
                });
                if (response.data.success) {
                  setCheckOutMessage('');
                  // Trigger Popup Motivation AFTER the success alert is closed
                  const workingHours = parseFloat(response.data.attendance?.total_working_hours || 0);
                  const isEarly = workingHours < (settings.workingHours.halfDayThreshold || 4);
                  
                  const msg = getEventMotivation(isEarly ? CATEGORIES.CHECK_OUT_EARLY : CATEGORIES.CHECK_OUT_NORMAL);
                  
                  setAlertDialog({ 
                    isOpen: true, 
                    title: 'Check-out Successful', 
                    message: 'Your check-out has been recorded successfully!\\n\\nWorking hours: ' + formatWorkingHours(parseFloat(response.data.attendance.total_working_hours)), 
                    type: 'success',
                    onCloseCallback: () => {
                      setTimeout(() => setMotivationPopup({ isOpen: true, message: msg }), 400); // Wait for alert to fade out
                    }
                  });

                  fetchData();
                }
              } catch (error) {
                setCheckOutMessage('');
                if (!error.isGlobalError) {
                  const config = mapErrorToDialogConfig(error);
                  window.dispatchEvent(new CustomEvent('showGlobalError', { detail: config }));
                }
              } finally { setIsCheckingOut(false); setCheckOutMessage(''); }
            },
          });
        } catch (e) { setIsCheckingOut(false); setCheckOutMessage(''); }`;

const newCheckoutBlock = `        setIsCheckingOut(true);
        try {
          const isElectron = window.attendanceDesktop?.isDesktopApp === true;
          const electronMode = settings.electronDesktop?.validationMode || 'trusted_device_and_network';
          const locationNotRequired = isElectron && ['trusted_device_only', 'network_only', 'trusted_device_or_network', 'trusted_device_and_network'].includes(electronMode);

          const performCheckOut = async (location = null) => {
            try {
              setCheckOutMessage('Collecting device information...');
              const deviceInfo = getDeviceInfo();
              const fingerprintData = getDeviceFingerprintData();
              setCheckOutMessage('Processing check-out...');
              const data = {
                latitude: location?.latitude,
                longitude: location?.longitude,
                address: location ? 'Location captured' : 'Location skipped by desktop policy',
                device_info: deviceInfo.device_info,
                browser_info: deviceInfo.browser_info,
                screenResolution: fingerprintData.screenResolution,
                timezone: fingerprintData.timezone,
                sessionId: localStorage.getItem('attendance_session_id'),
                isElectronDesktop: isElectron,
                locationSkippedReason: locationNotRequired ? 'electron-desktop-validation-mode' : undefined,
                electronValidationMode: isElectron ? electronMode : undefined
              };
              const response = await checkOut(data);
              
              if (response.data.success) {
                setCheckOutMessage('');
                // Trigger Popup Motivation AFTER the success alert is closed
                const workingHours = parseFloat(response.data.attendance?.total_working_hours || 0);
                const isEarly = workingHours < (settings.workingHours.halfDayThreshold || 4);
                
                const msg = getEventMotivation(isEarly ? CATEGORIES.CHECK_OUT_EARLY : CATEGORIES.CHECK_OUT_NORMAL);
                
                setAlertDialog({ 
                  isOpen: true, 
                  title: 'Check-out Successful', 
                  message: 'Your check-out has been recorded successfully!\\n\\nWorking hours: ' + formatWorkingHours(parseFloat(response.data.attendance.total_working_hours)), 
                  type: 'success',
                  onCloseCallback: () => {
                    setTimeout(() => setMotivationPopup({ isOpen: true, message: msg }), 400); // Wait for alert to fade out
                  }
                });

                fetchData();
              } else {
                setCheckOutMessage(''); 
                setAlertDialog({ isOpen:true, title:'❌ Check-out Failed', message:response.data.message || 'Check-out failed. Please try again.', type:'error' });
              }
            } catch (error) {
              setCheckOutMessage('');
              if (!error.isGlobalError) {
                const config = mapErrorToDialogConfig(error);
                window.dispatchEvent(new CustomEvent('showGlobalError', { detail: config }));
              }
            } finally { setIsCheckingOut(false); setCheckOutMessage(''); }
          };

          if (locationNotRequired) {
            await performCheckOut(null);
          } else {
            setLocationDialog({ isOpen:true, title:settings.messages.locationPermissionTitle, message:settings.messages.locationPermissionMessage, type:'permission',
              onAllow: async () => {
                try {
                  setCheckOutMessage('Getting your location...');
                  const location = await getCurrentLocation();
                  await performCheckOut(location);
                } catch (error) {
                  setIsCheckingOut(false); setCheckOutMessage('');
                  if (isElectron && (error.type === 'denied' || error.type === 'unavailable' || error.type === 'timeout')) {
                    window.dispatchEvent(new CustomEvent('showGlobalError', { detail: mapErrorToDialogConfig({ response: { data: { errorCode: 'DESKTOP_GPS_NOT_AVAILABLE' } } }) }));
                  } else {
                    window.dispatchEvent(new CustomEvent('showGlobalError', { detail: mapErrorToDialogConfig(error) }));
                  }
                }
              },
            });
          }
        } catch (e) { setIsCheckingOut(false); setCheckOutMessage(''); }`;

// Normalize endings for matching
const normContent = content.replace(/\\r\\n/g, '\\n');
const normOriginal = originalCheckoutBlock.replace(/\\r\\n/g, '\\n');

if (normContent.indexOf(normOriginal) !== -1) {
    const updatedContent = normContent.replace(normOriginal, newCheckoutBlock);
    fs.writeFileSync(dashboardPath, updatedContent);
    console.log("Replaced handleCheckOut successfully");
} else {
    console.log("Could not find the original handleCheckOut block. Attempting fallback...");
    // Just find "setIsCheckingOut(true);" and replace everything until "} catch (e) { setIsCheckingOut(false); setCheckOutMessage(''); }"
    const start = normContent.indexOf('        setIsCheckingOut(true);');
    const endStr = '} catch (e) { setIsCheckingOut(false); setCheckOutMessage(\'\'); }';
    const end = normContent.indexOf(endStr, start);
    
    if (start !== -1 && end !== -1) {
        const updatedContent = normContent.substring(0, start) + newCheckoutBlock + normContent.substring(end + endStr.length);
        fs.writeFileSync(dashboardPath, updatedContent);
        console.log("Replaced handleCheckOut successfully via fallback bounds");
    } else {
        console.log("Fallback failed as well.");
    }
}
