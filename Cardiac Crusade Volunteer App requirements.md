This is the requirements document for a Cardiac Crusade Volunteer web application that is designed to coordinate volunteers in the identification, verification, and registration of Automated External Defibrillators (AEDs). The goal is to ensure community AEDs are registered with PulsePoint, the authoritative source for emergency response.                                                                                                                                                    
                                                                      
   
Personas:

1. Application administrator  
2. City Coordinator  
3. CHAARG leader  
4. Volunteers

                                                                                                                                                       
Functional requirements:  
 

* The application administrator e-mail and password will be created when the application is created.

* The application will have four views:  users, settings, map, list.  The Users view will only be accessible by the Application Administrator, City Coordinator, or CHAARG leader roles.  
     
* Users, settings, and map views will be accessible via a navbar at the top.  Settings will be accessible via a gear icon in the upper right, with a logout icon to the right of it.  
     
* The settings view will allow users to change or set a password, or register a passkey, or link a social login.  Application administrators will also have an option to set the Google Places API key, to select the limit on number of Google Places API results returned with a single query, which will default to 10, and to backup or restore the database.  
   

Users view:  

* The application administrator will be able to use the users view to create other users and assign them the Application Administrator, City Coordinator, CHAARG Leader, or Volunteer roles.  
* City Coordinators and CHAARG Leaders will be able to create other users.  City Coordinators may assign the CHAARG Leader or Volunteer roles.  CHAARG Leaders may only create users with the Volunteer role.  By default, a new user's roll-up-to field will be set to the City Coordinator or CHAARG Leader who created the new user.  
* Users of type Volunteer may have a "roll up to" field populated with either a CHAARG Leader or a City Coordinator.  Users of type CHAARG Leader may have a "roll up to" field populated with a City Coordinator.  These associations will be used for roll-up reporting.  
* For any users without a "roll up to" field populated, put "(will not be included in reporting)" next to the user.  
* The application administrator will be able to see all users in the system, along with their role and their roll-up-to field.  
* City Coordinators will be able to see all users whose 'roll-up-to' field is set to the current user, or set to a CHAARG Leader whose 'roll-up-to' field is set to the current user.  
* CHAARG Leaders will only be able to see users whose 'roll-up-to' field is set to the current user.  
   
   
Map view and List view:

* Map view and list view will each display the targeted locations.  
* City coordinator or CHAARG leaders will have an Assign button to assign, unassign, or reassign the following to a volunteer:  
  1. A geographical area, by drawing a rectangle on the map.  After the area is selected, it will display the number of targeted locations currently inside that area.  The area may then be resized using both corner resizers or side resizers, and the map may be zoomed in and out with pinch gestures while the resizing is taking place.  Once the confirm button is clicked, all targeted locations within that area will be assigned to the selected user unless the targeted locations were specifically overridden.   
  2. Specific targeted locations.  A targeted location may be selected from the map view or list view and assigned/reassigned/unassigned to a user.  If a targeted location is specifically assigned to a volunteer, that assignment will take precedence over the geographical area assignment for another volunteer.  
* City coordinator or CHAARG leaders may import a list of targeted locations based on a dropdown list of pre-populated categories in CATEGORIES.txt, or may type in a category.  
  1. Ask for the correct city to use, default is Lexington, KY.   
  2. Use the Google Places API to query for places in that city that match the category name, and import the business name, address, GPS coordinates, and telephone number (if telephone number is available).  Do not import duplicates.  Duplicates are defined as any business where both a fuzzy match of the business name and a fuzzy match of the business address both match.  
  3. Provide a list of non-duplicate targeted locations that may be imported for review.  Initially, all candidate locations should be selected, with the option to deselect locations, and a "deselect all" button.  
  4. When the "confirm import" button is selected, non-duplicate targeted locations will be imported with a status of Unvisited.  If a location falls within an area already drawn and assigned to a volunteer, it should be automatically assigned to that volunteer. Otherwise, it remains unassigned.

* Locations on the map will be color-coded as follows:
  - **Gold**: Status is "AED located and mapped at aed.new - Done".
  - **Gray**: Unassigned and status is "Unvisited".
  - **Blue**: Assigned and status is "Unvisited".
  - **Yellow**: Status ends with "Follow up" or "Follow-up".
  - **Green**: Any other status that ends with "Done".

* City Coordinator, CHAARG leaders, and volunteers may select a location to view it.  On the view screen, there should be a link "Identify or Verify this AED" link that opens [https://aed.new](https://aed.new) in a new window.  Also on the view screen, the user may change the status of a location to one of the following and click Save:  
     
  Unvisited  
  AED status unknown \- Follow-up  
  AED located and mapped at aed.new \- Done  
  Refused or requested not to be mapped \- Done  
  AED located, not mapped yet \- Follow up  
  AED not present \- Done


* When the status is changed to "AED Located and Mapped \- Done" and saved, a confirmation message that states "Please confirm that you have mapped this in [https://aed.new](https://aed.new)." with a "Confirm" button.  Once confirm is selected, a one second confetti animation will appear, followed by "Thank you\!  Please look for other nearby locations that may have AEDs."  
* When the status is changed to any thing else other than Unvisited, please display "Thank you\!  Please look for other locations around that may have AEDs."  
* The location's entry will maintain an audit log of who changed the status and when.

   
Reporting: 

* City coordinator or CHAARG leaders can see volunteer progress by individual volunteer, or rolled up by CHAARG leaders, or rolled up by city coordinator.  
* Progress has two metrics:  Number of locations where the user changed the status to "AED Located and mapped at aed.new \- Done", and number of locations where the user changed the status to any other status except for "Unvisited".  


Non-functional requirements:  
   
Allow the following authentication methods, in order of preference.  An e-mail address will also be collected for all methods except e-mail/password in order to enable account recovery. 

1. FIDO2 registration with an e-mail address.   
2. Facebook social login  
3. Google social login  
4. E-mail/password  
    
Forgot password flow:  An E-mail one time password can be used as "forgot password" mechanism.  In the case of social login, "forgot password" will remind the user that they logged in with Facebook or Google.  In other cases, a cryptographically secure six digit OTP will be e-mailed to the user.  Successful entry of the OTP will allow the user to register another FIDO2 passkey, set a new password, or link to a Facebook/Google account.  The OTP for an account will be invalidated after three incorrect attempts to enter it.  After 3 incorrect attempts, OTP generation for that account will be blocked for 5 minutes.  Use any other industry best practices needed to prevent brute force OTP attacks.  


Package the application as a docker file.  Initially this file will run locally and mount a database from the local filesystem, and eventually it will be deployed to a kubernetes server.

Style the application using the same colors and fonts as https://cardiaccrusade.org/ .
