import { useState, useEffect } from 'react'; 
import './App.scss';
import AppTitle from './components/AppTitle/AppTitle';
import { fetchWidgetData } from '@rms/services';
import { dataLayerPushView } from '@rms/services'; // Import des fonctions analytiques
import { db } from '@rms/services';
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import LoadingOverlay from './components/LoadingOverlay/LoadingOverlay';

import iconMegaphone from './assets/img/icon-megaphone.svg';
import iconMessageCheck from './assets/img/icon-message-check.svg';


// Déclaration du composant principal App
function App() {
// Déclaration des états locaux :
    // - `calendar` : Contient les données du calendrier récupérées depuis Firestore.
    // - `showAll` : Indique si tous les éléments du calendrier doivent être affichés.
    // - `loading` : Indique si les données sont en cours de chargement.
    const [docId, setDocId] = useState(null);
    const [testimony, setTestimony] = useState(null);
    const [showAll, setShowAll] = useState(false);
    const [appMode, setAppMode] = useState(null); // null pendant le chargement, puis 'cta', 'form', 'thank', 'expired'
    
    // States pour le formulaire
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        message: '',
        privacy: false
    });
    const [formErrors, setFormErrors] = useState({});

    // Fonction exécutée lorsque la page est chargée
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const testimonyDoc = urlParams.get('testimonyDoc'); // Récupère la valeur du paramètre `testimonyDoc`.

       

        if (!testimonyDoc) {
            console.log('Aucun testimony trouvé.');
            // On laisse appMode à null pour rester bloqué sur le loader
            return;
        }

        setDocId(testimonyDoc); // Met à jour l'état `docId` avec la valeur de testimonyDoc

         async function loadTestimony() {
            try {
                const data = await fetchWidgetData(testimonyDoc); // Appel à l'API pour récupérer les données.
                
                if (!data) {
                    throw new Error("Aucun document trouvé");
                }
                
                setTestimony(data); // Mise à jour de l'état `folder` avec les données récupérées.
                
                const timeExpires = data?.data?.timeExpires || data?.data?.content?.timeExpires || data?.content?.timeExpires;
                
                // Vérifier si le formulaire a expiré
                if (timeExpires) {
                    const now = new Date();
                    const expirationDate = timeExpires.toDate ? timeExpires.toDate() : new Date(timeExpires); // Convertir le timestamp Firestore en Date
                    
                 
                    
                    if (now > expirationDate) {
                        // Le formulaire a expiré
                        setAppMode('expired');
                    } else {
                        // Le formulaire est encore valide
                        setAppMode('cta');
                    }
                } else {
                    // Pas de date d'expiration définie, utiliser le mode par défaut
                    setAppMode('cta');
                }
                
                // Appeler la fonction dataLayer pour l'impression/affichage
                
                // Incrémenter le compteur de vues
                await incrementViewCounter(testimonyDoc);
                dataLayerPushView(testimonyDoc, 'TESTIMONY');
            } catch (error) {
                console.error('Erreur lors du chargement du testimony:', error);
                // En cas d'erreur, on laisse appMode à null pour rester bloqué sur le loader
            }
        }

        loadTestimony();
    }, []); // Le tableau de dépendances vide signifie que cet effet est exécuté une seule fois.



    async function incrementViewCounter(docId) {
        try {
            const testimonyRef = doc(db, 'widgets', docId);
            await updateDoc(testimonyRef, {
                'stats.views': increment(1), // Incrémente la valeur de 1
            });
        } catch (error) {
            console.error('Erreur lors de l\'incrémentation du compteur de vues :', error);
        }
    }

    async function incrementMsgSentCounter(docId) {
        try {
            const testimonyRef = doc(db, 'widgets', docId);
            await updateDoc(testimonyRef, {
                'stats.msgSent': increment(1), // Incrémente atomiquement la valeur de 1
            });
        } catch (error) {
            console.error('Erreur lors de l\'incrémentation du compteur de messages envoyés :', error);
        }
    }

    

    const handleStartQuestionnaire = () => {
        setAppMode('form');
    };

    const validateForm = () => {
        const errors = {};
        
        if (!formData.name.trim()) {
            errors.name = 'Le nom est requis';
        }
        
        if (!formData.email.trim()) {
            errors.email = 'L\'adresse e-mail est requise';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = 'L\'adresse e-mail n\'est pas valide';
        }
        
        if (!formData.message.trim()) {
            errors.message = 'Le message est requis';
        }
        
        if (!formData.privacy) {
            errors.privacy = 'Vous devez accepter la politique de confidentialité';
        }
        
        return errors;
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        
        // Supprimer l'erreur du champ modifié
        if (formErrors[name]) {
            setFormErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const saveMessageToFirebase = async (messageData) => {
        try {
            // Créer une référence à la sous-collection messages du document testimony
            const messagesRef = collection(db, 'widgets', docId, 'messages');
            
            // Ajouter le nouveau message avec un timestamp automatique
            const docRef = await addDoc(messagesRef, {
                email: messageData.email,
                name: messageData.name,
                text: messageData.message,
                timeSent: serverTimestamp()
            });
            
            console.log('Message sauvegardé avec ID:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Erreur lors de la sauvegarde du message:', error);
            throw error;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const errors = validateForm();
        setFormErrors(errors);
        
        if (Object.keys(errors).length === 0) {
            try {
                // Formulaire valide, sauvegarder dans Firebase
                await saveMessageToFirebase(formData);
                
                // Incrémenter atomiquement le compteur de messages envoyés dans Firebase
                await incrementMsgSentCounter(docId);
                
                // Passer au mode remerciement
                setAppMode('thank');
            } catch (error) {
                console.error('Erreur lors de l\'envoi:', error);
                // Vous pourriez ajouter une gestion d'erreur ici
                // Par exemple, afficher un message d'erreur à l'utilisateur
            }
        }
    };

    return (
        <div className="App overflow-hidden relative p-2.5 sm:p-5 font-inter">
            {appMode === null && (
                // Affichage pendant la vérification de l'expiration
                <LoadingOverlay />
            )}

            {appMode === 'cta' && (
                <>
                    <AppTitle 
                        icon={iconMegaphone} 
                        label={testimony?.data?.title || testimony?.data?.content?.title || testimony?.content?.title} 
                    />
                    
                    <div className='text-center mb-5 sm:mb-10'>
                        <span className='text-base sm:text-lg leading-6 sm:leading-7'><u>{testimony?.data?.subject || testimony?.data?.content?.subject || testimony?.content?.subject}:</u> {testimony?.data?.question || testimony?.data?.content?.question || testimony?.content?.question}</span>
                    </div>
                    <div>
                        <button 
                            onClick={handleStartQuestionnaire}
                            className='w-full text-white text-center font-inter font-bold h-12 bg-blick rounded-full border-none cursor-pointer'
                        >
                            Je participe
                        </button>
                    </div>
                  
                </>
            )}

            {appMode === 'form' && (
                <>
                    <AppTitle 
                        icon={iconMegaphone} 
                        label={testimony?.data?.title || testimony?.data?.content?.title || testimony?.content?.title} 
                    />
                    <div className='text-center mb-8 sm:mb-10'>
                        <span className='text-base sm:text-lg leading-6 sm:leading-7'><u>{testimony?.data?.subject || testimony?.data?.content?.subject || testimony?.content?.subject}:</u> {testimony?.data?.question || testimony?.data?.content?.question || testimony?.content?.question}</span>
                    </div>
                    <form className='space-y-5 -mt-3' onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="name" className='block text-sm font-bold mb-2'>
                                Votre nom
                            </label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className={`w-full h-12 px-6 py-2 border rounded-full focus:outline-none focus:ring-0 ${
                                    formErrors.name ? 'error' : ''
                                }`}
                            />
                            {formErrors.name && <p className="error-message">{formErrors.name}</p>}
                        </div>

                        <div>
                            <label htmlFor="email" className='block text-sm font-bold mb-2'>
                                Adresse e-mail
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                className={`w-full h-12 px-6 py-2 border rounded-full focus:outline-none focus:ring-0 ${
                                    formErrors.email ? 'error' : ''
                                }`}
                            />
                            {formErrors.email && <p className="error-message">{formErrors.email}</p>}
                        </div>

                        <div>
                            <label htmlFor="message" className='block text-sm font-bold mb-2'>
                                Message
                            </label>
                            <textarea
                                id="message"
                                name="message"
                                rows="5"
                                value={formData.message}
                                onChange={handleInputChange}
                                className={`w-full px-6 py-3 border rounded-2xl focus:outline-none focus:ring-0 resize-none ${
                                    formErrors.message ? 'error' : ''
                                }`}
                            ></textarea>
                            {formErrors.message && <p className="error-message">{formErrors.message}</p>}
                        </div>

                        <div className='flex items-start space-x-3'>
                            <input
                                type="checkbox"
                                id="privacy"
                                name="privacy"
                                checked={formData.privacy}
                                onChange={handleInputChange}
                                className='mt-1 h-4 w-4 text-gray-600 focus:ring-0 focus:ring-offset-0 border-gray-300 rounded'
                            />
                            <div>
                                <label htmlFor="privacy" className='text-base'>
                                    J'accepte que mes informations soient traitées par Blick conformément à la <a target="_blank" rel="noopener noreferrer" href="https://www.blick.ch/fr/services/dispositions-de-protection-des-donnees-id18211424.html" className='text-default'><u>politique de confidentialité</u></a>.
                                </label>
                                {formErrors.privacy && <p className="error-message">{formErrors.privacy}</p>}
                            </div>
                        </div>

                        <div>
                            <button 
                                type="submit"
                                className='w-full text-white text-center font-inter font-bold h-12 bg-blick rounded-full border-none cursor-pointer'
                            >
                                Envoyer
                            </button>
                        </div>
                    </form>
                    <span className='text-weak block text-xs mt-5'>Les données que vous nous transmettez via ce formulaire sont traitées de manière confidentielle par Blick. Elles ne seront utilisées que dans le cadre de notre travail journalistique lié à ce sujet, et ne seront jamais partagées avec des tiers sans votre accord.</span>
                </>
            )}

            {appMode === 'thank' && (
                <div>
                    {/* Affichage du remerciement */}
                    <AppTitle 
                        icon={iconMessageCheck} 
                        label="Merci" 
                    />
                    <div className='text-center'>
                        <span className='text-base sm:text-lg leading-6 sm:leading-7'>Merci pour votre témoignage. Un membre de notre rédaction pourra vous contacter si nous souhaitons en savoir plus.</span>
                    </div>
                </div>
            )}

            {appMode === 'expired' && (
                <>
                    {/* Affichage du mode expiré */}
                    <AppTitle 
                        icon={iconMegaphone} 
                        label={testimony?.data?.title || testimony?.data?.content?.title || testimony?.content?.title} 
                    />
                     <div className='text-center mb-8 sm:mb-10'>
                        <span className='text-base sm:text-lg leading-6 sm:leading-7'><u>{testimony?.data?.subject || testimony?.data?.content?.subject || testimony?.content?.subject}:</u> {testimony?.data?.question || testimony?.data?.content?.question || testimony?.content?.question}</span>
                    </div>
                    <div>
                        <button 
                            disabled
                            className='w-full text-white text-center font-inter font-bold h-12 bg-blick rounded-full border-none opacity-50 cursor-not-allowed'
                        >
                            Ce formulaire a expiré
                        </button>
                    </div>
                </>
            )}

        </div>
    );
}

export default App;
