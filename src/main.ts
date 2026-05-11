import './styles.css';
import { mountApp } from './app';
import { registerServiceWorker } from './sw-register';

mountApp(document.getElementById('app'));
registerServiceWorker();
